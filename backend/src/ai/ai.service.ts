import {
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';

import { ExceptionsService } from '../exceptions/exceptions.service.js';
import { OrdersService } from '../orders/orders.service.js';
import { AllocationService } from '../allocation/allocation.service.js';
import { AuditEntityType, AuditService } from '../audit/audit.service.js';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message;
  }

  return String(error);
}

function getProviderStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }

  const candidate = error as {
    status?: unknown;
    statusCode?: unknown;
    code?: unknown;
    response?: { status?: unknown };
  };

  const possibleStatuses = [
    candidate.status,
    candidate.statusCode,
    candidate.response?.status,
  ];

  for (const value of possibleStatuses) {
    const status = Number(value);

    if (Number.isInteger(status) && status >= 400 && status <= 599) {
      return status;
    }
  }

  return undefined;
}

/**
 * Gemini retry/timeout policy.
 *
 * The whole generateText() call (all attempts plus backoff) is bounded by
 * GEMINI_TOTAL_BUDGET_MS, so the backend always answers before the frontend's
 * AI request timeout (AI_REQUEST_TIMEOUT_MS in frontend aiSlice.ts, 110s).
 * Observed successful Gemini calls take 70-85s, so a single attempt may use
 * the full budget; retries only happen when an attempt fails fast (e.g. 503).
 */
export const GEMINI_TOTAL_BUDGET_MS = 100_000;
// One retry only: the free tier allows ~20 requests/day and each retry
// may count against that daily quota.
export const GEMINI_MAX_RETRIES = 1;
const GEMINI_BACKOFF_BASE_MS = 1_000;
const GEMINI_BACKOFF_MAX_JITTER_MS = 1_000;
// Do not start a retry unless at least this much budget remains for it.
const GEMINI_MIN_ATTEMPT_MS = 15_000;

const RETRYABLE_PROVIDER_STATUSES = new Set([500, 502, 503]);

const RETRYABLE_NETWORK_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'EAI_AGAIN',
  'EPIPE',
  'UND_ERR_SOCKET',
  'UND_ERR_CONNECT_TIMEOUT',
]);

function getNetworkErrorCode(error: unknown): string | undefined {
  // Node's fetch (undici) reports network failures as
  // TypeError('fetch failed') with the system error code on `cause`.
  let current: unknown = error;

  for (let depth = 0; depth < 3 && current; depth += 1) {
    if (typeof current !== 'object') {
      return undefined;
    }

    const { code, cause } = current as { code?: unknown; cause?: unknown };

    if (typeof code === 'string') {
      return code;
    }

    current = cause;
  }

  return undefined;
}

function isTransientNetworkError(error: unknown): boolean {
  const code = getNetworkErrorCode(error);

  if (code && RETRYABLE_NETWORK_CODES.has(code)) {
    return true;
  }

  return (
    error instanceof TypeError &&
    error.message.toLowerCase().includes('fetch failed')
  );
}

function isQuotaError(
  providerStatus: number | undefined,
  normalizedMessage: string,
): boolean {
  return (
    providerStatus === 429 ||
    normalizedMessage.includes('quota exceeded') ||
    normalizedMessage.includes('exceeded your current quota') ||
    normalizedMessage.includes('resource_exhausted') ||
    normalizedMessage.includes('generate_content_free_tier_requests') ||
    normalizedMessage.includes('rate limit') ||
    normalizedMessage.includes('too many requests')
  );
}

function isRetryableGeminiError(error: unknown): boolean {
  if (error instanceof HttpException) {
    return false;
  }

  const providerStatus = getProviderStatus(error);
  const normalizedMessage = getErrorMessage(error).toLowerCase();

  // Never retry quota exhaustion, even if the message also mentions 5xx text.
  if (isQuotaError(providerStatus, normalizedMessage)) {
    return false;
  }

  if (providerStatus !== undefined) {
    return RETRYABLE_PROVIDER_STATUSES.has(providerStatus);
  }

  return isTransientNetworkError(error);
}

/**
 * Stable error codes returned in AI error response bodies. The frontend
 * (frontend/src/features/ai/aiErrors.ts) maps these to user-facing text.
 */
export const AI_ERROR_MESSAGES = {
  GEMINI_QUOTA_EXHAUSTED:
    'Gemini daily request quota exhausted. Try again after the quota resets.',
  GEMINI_RATE_LIMITED:
    'Gemini per-minute request limit reached. Please wait a minute and try again.',
  GEMINI_UNAVAILABLE:
    'Gemini is temporarily unavailable due to high demand. Please try again later.',
  GEMINI_TIMEOUT: 'The AI request took too long. Please try again later.',
  GEMINI_UNREACHABLE:
    'Unable to reach the Gemini API. Please check network connectivity and try again.',
  GEMINI_REQUEST_FAILED:
    'Gemini API request failed. Please check the provider configuration and availability.',
} as const;

export type AiErrorCode = keyof typeof AI_ERROR_MESSAGES;

function aiHttpException(
  statusCode: HttpStatus,
  errorCode: AiErrorCode,
): HttpException {
  return new HttpException(
    { statusCode, errorCode, message: AI_ERROR_MESSAGES[errorCode] },
    statusCode,
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Gemini sometimes returns Markdown even when asked for plain text.
 * The UI renders drafts as plain text, so remove backslash escapes
 * (e.g. "\*\*Subject:\*\*") and bold markers.
 */
function toPlainText(text: string): string {
  return text
    .replace(/\\([*_#`~>[\]-])/g, '$1')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .trim();
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly exceptionsService: ExceptionsService,
    private readonly ordersService: OrdersService,
    private readonly allocationService: AllocationService,
    private readonly audit: AuditService,
  ) {}

  private get modelName(): string {
    return (
      this.configService.get<string>('GEMINI_MODEL') ?? 'gemini-3.8-flash'
    );
  }

  /**
   * Run a generation and record the outcome in the audit log. The prompt
   * itself is not stored (it embeds full order and exception data); its
   * size and the inputs it was built from are.
   */
  private async generateAudited(
    prompt: string,
    audit: {
      entityId: string;
      entityRef: string | null;
      action: string;
      inputs: Record<string, unknown>;
    },
    postProcess: (text: string) => string = (text) => text,
  ): Promise<string> {
    const startedAt = Date.now();

    try {
      const output = postProcess(await this.generateText(prompt));

      await this.audit.recordSafely({
        entityType: AuditEntityType.AI_INTERACTION,
        entityId: audit.entityId,
        entityRef: audit.entityRef,
        action: audit.action,
        before: { ...audit.inputs, promptCharacters: prompt.length },
        after: {
          model: this.modelName,
          outcome: 'SUCCESS',
          durationMs: Date.now() - startedAt,
          output,
        },
      });

      return output;
    } catch (error) {
      const response =
        error instanceof HttpException ? error.getResponse() : undefined;

      await this.audit.recordSafely({
        entityType: AuditEntityType.AI_INTERACTION,
        entityId: audit.entityId,
        entityRef: audit.entityRef,
        action: audit.action,
        before: { ...audit.inputs, promptCharacters: prompt.length },
        after: {
          model: this.modelName,
          outcome: 'FAILED',
          durationMs: Date.now() - startedAt,
          httpStatus:
            error instanceof HttpException ? error.getStatus() : null,
          errorCode:
            response && typeof response === 'object' && 'errorCode' in response
              ? response.errorCode
              : null,
        },
      });

      throw error;
    }
  }

  private async generateText(prompt: string): Promise<string> {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');

    const model = this.modelName;

    if (!apiKey) {
      this.logger.error('GEMINI_API_KEY is not configured.');

      throw new ServiceUnavailableException(
        'AI service is not configured. Please contact the administrator.',
      );
    }

    const ai = new GoogleGenAI({ apiKey });
    const deadline = Date.now() + GEMINI_TOTAL_BUDGET_MS;
    const maxAttempts = GEMINI_MAX_RETRIES + 1;

    for (let attempt = 1; ; attempt += 1) {
      const attemptTimeoutMs = Math.max(deadline - Date.now(), 1);
      const controller = new AbortController();
      const timeoutHandle = setTimeout(
        () => controller.abort(),
        attemptTimeoutMs,
      );
      const startedAt = Date.now();

      try {
        this.logger.log(
          `Gemini request started. Model: ${model}. Attempt ${attempt}/${maxAttempts}. ` +
            `Timeout: ${Math.round(attemptTimeoutMs / 1000)}s`,
        );

        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            abortSignal: controller.signal,
            systemInstruction:
              'You are a supply chain operations assistant. ' +
              'Use only the supplied data. Never invent inventory, quantities, ' +
              'delivery dates, or commitments. Clearly distinguish facts from recommendations.',
          },
        });

        this.logger.log(
          `Gemini API response received after ${Date.now() - startedAt}ms ` +
            `(attempt ${attempt}/${maxAttempts}).`,
        );

        const text = response.text?.trim();

        if (!text) {
          throw new InternalServerErrorException(
            'The AI provider returned an empty response.',
          );
        }

        return text;
      } catch (error) {
        if (error instanceof HttpException) {
          throw error;
        }

        const timedOut = controller.signal.aborted;
        const safeMessage = getErrorMessage(error)
          .replaceAll(apiKey, '[REDACTED]')
          .slice(0, 1000);

        this.logger.error(
          `Gemini request failed after ${Date.now() - startedAt}ms ` +
            `(attempt ${attempt}/${maxAttempts}). ` +
            `Status: ${getProviderStatus(error) ?? (timedOut ? 'timeout' : 'unknown')}. ` +
            `Error: ${safeMessage}`,
        );

        if (!timedOut && attempt < maxAttempts && isRetryableGeminiError(error)) {
          const delayMs =
            GEMINI_BACKOFF_BASE_MS * 2 ** (attempt - 1) +
            Math.floor(Math.random() * GEMINI_BACKOFF_MAX_JITTER_MS);
          const remainingAfterDelay = deadline - Date.now() - delayMs;

          if (remainingAfterDelay >= GEMINI_MIN_ATTEMPT_MS) {
            this.logger.warn(
              `Retrying Gemini request in ${delayMs}ms ` +
                `(retry ${attempt}/${GEMINI_MAX_RETRIES}).`,
            );
            await sleep(delayMs);
            continue;
          }

          this.logger.warn(
            'Not retrying Gemini request: insufficient time budget remaining.',
          );
        }

        throw this.toHttpException(error, timedOut);
      } finally {
        clearTimeout(timeoutHandle);
      }
    }
  }

  /**
   * Maps a final Gemini failure to a NestJS HTTP exception.
   * Each body carries a stable `errorCode` (see AI_ERROR_MESSAGES) so the
   * frontend can tell quota exhaustion, provider unavailability and timeouts
   * apart without parsing message text. The API key is never included.
   */
  private toHttpException(error: unknown, timedOut: boolean): HttpException {
    const providerStatus = getProviderStatus(error);
    const normalizedMessage = getErrorMessage(error).toLowerCase();
    const errorName =
      error instanceof Error ? error.name.toLowerCase() : '';

    // Quota / rate limit. Never retried.
    if (isQuotaError(providerStatus, normalizedMessage)) {
      // Gemini 429 bodies name the exhausted quota, e.g.
      // "GenerateRequestsPerMinutePerProjectPerModel-FreeTier".
      const errorCode: AiErrorCode = normalizedMessage.includes('perminute')
        ? 'GEMINI_RATE_LIMITED'
        : 'GEMINI_QUOTA_EXHAUSTED';

      return aiHttpException(HttpStatus.TOO_MANY_REQUESTS, errorCode);
    }

    // Gemini model temporarily unavailable or experiencing high demand.
    if (providerStatus === 503) {
      return aiHttpException(
        HttpStatus.SERVICE_UNAVAILABLE,
        'GEMINI_UNAVAILABLE',
      );
    }

    // Our own deadline fired, or the provider reported a timeout.
    if (
      timedOut ||
      providerStatus === 408 ||
      providerStatus === 504 ||
      errorName === 'aborterror' ||
      errorName === 'timeouterror' ||
      normalizedMessage.includes('timeout') ||
      normalizedMessage.includes('timed out')
    ) {
      return aiHttpException(HttpStatus.GATEWAY_TIMEOUT, 'GEMINI_TIMEOUT');
    }

    if (
      normalizedMessage.includes('high demand') ||
      normalizedMessage.includes('unavailable')
    ) {
      return aiHttpException(
        HttpStatus.SERVICE_UNAVAILABLE,
        'GEMINI_UNAVAILABLE',
      );
    }

    // Gemini could not be reached (connection reset, DNS, etc.).
    if (providerStatus === undefined && isTransientNetworkError(error)) {
      return aiHttpException(
        HttpStatus.SERVICE_UNAVAILABLE,
        'GEMINI_UNREACHABLE',
      );
    }

    // Other errors returned by the external AI provider.
    return aiHttpException(HttpStatus.BAD_GATEWAY, 'GEMINI_REQUEST_FAILED');
  }

  async generateExceptionSummary() {
    this.logger.log('Exception summary: fetching exceptions...');

    const result = await this.exceptionsService.findAll();

    const prompt = `
Analyze this live supply-chain exception data.

Exception data:
${JSON.stringify(result, null, 2)}

Produce an operational summary with these sections:

1. Overall situation
2. Most critical exceptions
3. Orders and customers at risk
4. Supply or inventory constraints
5. Recommended planner actions

Requirements:
- Use actual order numbers and quantities from the supplied data.
- Prioritize HIGH severity, then MEDIUM, then LOW.
- If there are no exceptions, clearly state that.
- Do not invent facts, quantities, or delivery dates.
- Clearly distinguish current facts from recommendations.
- Keep the response concise and useful to a supply-chain planner.
`;

    this.logger.log(
      'Exception summary: exceptions fetched. Preparing prompt...',
    );

    const summary = await this.generateAudited(prompt, {
      entityId: 'exception-summary',
      entityRef: null,
      action: 'AI_EXCEPTION_SUMMARY',
      inputs: { exceptionCount: result.totalExceptions },
    });

    return {
      generatedAt: new Date(),
      exceptionCount: result.totalExceptions,
      summary,
    };
  }

  async generateCustomerCommunication(orderId: string) {
    const order = await this.ordersService.findOne(orderId);

    const plan = await this.allocationService.getPlan();

    const allocation = plan.orders.find(
      (item) => item.orderId === orderId,
    );

    const allExceptions = await this.exceptionsService.findAll();

    const orderExceptions = allExceptions.exceptions.filter(
      (item) => item.orderId === orderId,
    );

    const prompt = `
Draft a professional customer-facing order update.

Order information:
${JSON.stringify(order, null, 2)}

Current allocation information:
${JSON.stringify(allocation ?? null, null, 2)}

Current exceptions:
${JSON.stringify(orderExceptions, null, 2)}

Requirements:
- Address the customer professionally by name using the order's customerName (for example "Dear ${order.customerName},"). Never use a placeholder such as "[Customer Name]".
- Explain the fulfillment situation in clear, simple language.
- The allocation information is an internal planning projection, not a reservation. Never say inventory is "secured", "reserved", "guaranteed", or "set aside".
- Only say the order is fully covered by available stock if every allocation line has backorderedQuantity 0. If allocation information is null, do not describe inventory availability at all.
- Mention shortages or delays only when supported by the supplied data.
- Do not expose internal severity classifications or technical allocation terminology.
- Never invent a delivery date or shipping commitment.
- An inbound receipt's expected arrival date is NOT a confirmed order shipping date.
- If inventory is expected to arrive on a particular date, describe it only as an expected inventory arrival.
- Never present allocation.promisedShipDate as a guaranteed customer shipping date.
- If the promised ship date is null, do not suggest a specific date.
- Do not claim an order has shipped unless its status is SHIPPED.
- Do not claim there are no delays unless the supplied data establishes that.
- Do not claim an order is delayed, on time, or shipping on any date unless the supplied data states it.
- Keep the message concise and empathetic.

Output format (plain text only, no Markdown, no asterisks, no backslashes):
Subject: <subject line>

<message body>

Return only the customer communication draft.
`;

    const draft = await this.generateAudited(
      prompt,
      {
        entityId: order.id,
        entityRef: order.orderNumber,
        action: 'AI_CUSTOMER_DRAFT',
        inputs: {
          orderStatus: order.status,
          exceptionCount: orderExceptions.length,
        },
      },
      toPlainText,
    );

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      generatedAt: new Date(),
      draft,
    };
  }
}
