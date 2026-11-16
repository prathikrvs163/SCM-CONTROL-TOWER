import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpException } from '@nestjs/common';
import { ApiError } from '@google/genai';
import {
  AI_ERROR_MESSAGES,
  AiService,
  GEMINI_MAX_RETRIES,
  GEMINI_TOTAL_BUDGET_MS,
} from './ai.service.js';
import type { AiErrorCode } from './ai.service.js';
import { ExceptionsService } from '../exceptions/exceptions.service.js';
import { OrdersService } from '../orders/orders.service.js';
import { AllocationService } from '../allocation/allocation.service.js';
import { AuditService } from '../audit/audit.service.js';

const { generateContent, recordSafely } = vi.hoisted(() => ({
  generateContent: vi.fn(),
  recordSafely: vi.fn(),
}));

vi.mock('@google/genai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@google/genai')>();

  return {
    ...actual,
    GoogleGenAI: vi.fn(function GoogleGenAI() {
      return { models: { generateContent } };
    }),
  };
});

const API_KEY = 'test-api-key-123';

const HIGH_DEMAND_503 = JSON.stringify({
  error: {
    code: 503,
    message:
      'This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.',
    status: 'UNAVAILABLE',
  },
});

function apiError(status: number, message: string) {
  return new ApiError({ status, message });
}

const QUOTA_DAILY_429 = JSON.stringify({
  error: {
    code: 429,
    status: 'RESOURCE_EXHAUSTED',
    message:
      'You exceeded your current quota. Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 20',
    details: [
      { quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier' },
    ],
  },
});

const QUOTA_MINUTE_429 = JSON.stringify({
  error: {
    code: 429,
    status: 'RESOURCE_EXHAUSTED',
    message: 'You exceeded your current quota.',
    details: [
      { quotaId: 'GenerateRequestsPerMinutePerProjectPerModel-FreeTier' },
    ],
  },
});

async function expectHttpError(
  promise: Promise<unknown>,
  status: number,
  errorCode?: AiErrorCode,
): Promise<HttpException> {
  const error: unknown = await promise.catch((caught: unknown) => caught);

  expect(error).toBeInstanceOf(HttpException);
  expect((error as HttpException).getStatus()).toBe(status);

  if (errorCode) {
    expect((error as HttpException).getResponse()).toEqual({
      statusCode: status,
      errorCode,
      message: AI_ERROR_MESSAGES[errorCode],
    });
  }

  return error as HttpException;
}

describe('AiService', () => {
  let service: AiService;
  let apiKey: string | undefined;

  beforeEach(async () => {
    generateContent.mockReset();
    recordSafely.mockReset();
    apiKey = API_KEY;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) =>
              key === 'GEMINI_API_KEY' ? apiKey : undefined,
          },
        },
        {
          provide: ExceptionsService,
          useValue: {
            findAll: () =>
              Promise.resolve({ totalExceptions: 2, exceptions: [] }),
          },
        },
        {
          provide: OrdersService,
          useValue: {
            findOne: () =>
              Promise.resolve({
                id: 'order-1',
                orderNumber: 'SO-1001',
                customerName: 'Acme Retail',
                status: 'CONFIRMED',
              }),
          },
        },
        {
          provide: AllocationService,
          useValue: { getPlan: () => Promise.resolve({ orders: [] }) },
        },
        {
          provide: AuditService,
          useValue: { recordSafely },
        },
      ],
    }).compile();

    service = module.get<AiService>(AiService);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('returns the summary on a successful Gemini response', async () => {
    generateContent.mockResolvedValueOnce({ text: '  All good.  ' });

    const result = await service.generateExceptionSummary();

    expect(result.summary).toBe('All good.');
    expect(result.exceptionCount).toBe(2);
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it('retries a 503 and succeeds on the next attempt', async () => {
    vi.useFakeTimers();
    generateContent
      .mockRejectedValueOnce(apiError(503, HIGH_DEMAND_503))
      .mockResolvedValueOnce({ text: 'Recovered summary.' });

    const promise = service.generateExceptionSummary();
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.summary).toBe('Recovered summary.');
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it('returns 503 GEMINI_UNAVAILABLE after the single retry is exhausted', async () => {
    vi.useFakeTimers();
    generateContent.mockRejectedValue(apiError(503, HIGH_DEMAND_503));

    const promise = service.generateExceptionSummary();
    const assertion = expectHttpError(promise, 503, 'GEMINI_UNAVAILABLE');
    await vi.runAllTimersAsync();
    await assertion;

    // 1 initial attempt + GEMINI_MAX_RETRIES (1) retry.
    expect(GEMINI_MAX_RETRIES).toBe(1);
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it('returns 429 GEMINI_QUOTA_EXHAUSTED for the daily quota and never retries', async () => {
    vi.useFakeTimers();
    generateContent.mockRejectedValue(apiError(429, QUOTA_DAILY_429));

    const promise = service.generateExceptionSummary();
    const assertion = expectHttpError(promise, 429, 'GEMINI_QUOTA_EXHAUSTED');
    await vi.runAllTimersAsync();
    await assertion;

    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it('returns 429 GEMINI_RATE_LIMITED for the per-minute limit and never retries', async () => {
    generateContent.mockRejectedValue(apiError(429, QUOTA_MINUTE_429));

    await expectHttpError(
      service.generateExceptionSummary(),
      429,
      'GEMINI_RATE_LIMITED',
    );
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it('reports 429 (not 503) when the 503 retry hits the quota', async () => {
    vi.useFakeTimers();
    generateContent
      .mockRejectedValueOnce(apiError(503, HIGH_DEMAND_503))
      .mockRejectedValueOnce(apiError(429, QUOTA_DAILY_429));

    const promise = service.generateExceptionSummary();
    const assertion = expectHttpError(promise, 429, 'GEMINI_QUOTA_EXHAUSTED');
    await vi.runAllTimersAsync();
    await assertion;

    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it.each([400, 401, 403])('does not retry a %i error', async (status) => {
    generateContent.mockRejectedValue(apiError(status, 'client error'));

    await expectHttpError(
      service.generateExceptionSummary(),
      502,
      'GEMINI_REQUEST_FAILED',
    );
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it('returns 503 without a Gemini errorCode when the API key is missing', async () => {
    apiKey = undefined;

    const error = await expectHttpError(
      service.generateExceptionSummary(),
      503,
    );

    expect(error.getResponse()).not.toHaveProperty('errorCode');
    expect(generateContent).not.toHaveBeenCalled();
  });

  it('retries a transient network failure', async () => {
    vi.useFakeTimers();
    generateContent
      .mockRejectedValueOnce(
        new TypeError('fetch failed', {
          cause: Object.assign(new Error('socket hang up'), {
            code: 'ECONNRESET',
          }),
        }),
      )
      .mockResolvedValueOnce({ text: 'After network blip.' });

    const promise = service.generateExceptionSummary();
    await vi.runAllTimersAsync();

    expect((await promise).summary).toBe('After network blip.');
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it('aborts at the time budget, returns 504 and does not retry', async () => {
    vi.useFakeTimers();
    let receivedSignal: AbortSignal | undefined;

    generateContent.mockImplementation(
      ({ config }: { config: { abortSignal: AbortSignal } }) => {
        receivedSignal = config.abortSignal;

        return new Promise((_, reject) => {
          config.abortSignal.addEventListener('abort', () => {
            reject(new DOMException('This operation was aborted', 'AbortError'));
          });
        });
      },
    );

    const promise = service.generateExceptionSummary();
    const assertion = expectHttpError(promise, 504, 'GEMINI_TIMEOUT');

    await vi.advanceTimersByTimeAsync(GEMINI_TOTAL_BUDGET_MS - 1);
    expect(receivedSignal?.aborted).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    await assertion;

    expect(receivedSignal?.aborted).toBe(true);
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it('does not retry a 503 when too little time budget remains', async () => {
    vi.useFakeTimers();
    generateContent.mockImplementation(async () => {
      // Simulate a slow attempt that fails late with 503.
      await new Promise((resolve) =>
        setTimeout(resolve, GEMINI_TOTAL_BUDGET_MS - 10_000),
      );
      throw apiError(503, HIGH_DEMAND_503);
    });

    const promise = service.generateExceptionSummary();
    const assertion = expectHttpError(promise, 503);
    await vi.runAllTimersAsync();
    await assertion;

    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it('never logs the API key', async () => {
    const errorSpy = vi
      .spyOn(service['logger'], 'error')
      .mockImplementation(() => undefined);
    generateContent.mockRejectedValue(
      apiError(400, `API key not valid: ${API_KEY}`),
    );

    await expectHttpError(service.generateExceptionSummary(), 502);

    const logged = errorSpy.mock.calls.flat().join(' ');
    expect(logged).not.toContain(API_KEY);
    expect(logged).toContain('[REDACTED]');
  });

  it('returns the customer draft as plain text with the customer name', async () => {
    generateContent.mockResolvedValueOnce({
      text: '\\*\\*Subject:\\*\\* Update on SO-1001\n\n**Dear Acme Retail,** thanks.',
    });

    const result = await service.generateCustomerCommunication('order-1');

    expect(result.draft).toBe(
      'Subject: Update on SO-1001\n\nDear Acme Retail, thanks.',
    );
    expect(result.customerName).toBe('Acme Retail');

    const [{ contents }] = generateContent.mock.calls[0] as [
      { contents: string },
    ];
    expect(contents).toContain('Dear Acme Retail,');
  });

  it('records a successful generation in the audit log without the prompt', async () => {
    generateContent.mockResolvedValueOnce({ text: 'Dear Acme Retail, thanks.' });

    await service.generateCustomerCommunication('order-1');

    expect(recordSafely).toHaveBeenCalledTimes(1);
    const [entry] = recordSafely.mock.calls[0] as [Record<string, any>];
    expect(entry).toMatchObject({
      entityType: 'AI_INTERACTION',
      entityId: 'order-1',
      entityRef: 'SO-1001',
      action: 'AI_CUSTOMER_DRAFT',
      after: {
        model: 'gemini-3.8-flash',
        outcome: 'SUCCESS',
        output: 'Dear Acme Retail, thanks.',
      },
    });
    expect(entry.before.promptCharacters).toBeGreaterThan(0);
    expect(JSON.stringify(entry)).not.toContain('Order information:');
  });

  it('records a failed generation with its errorCode and still throws', async () => {
    generateContent.mockRejectedValueOnce(apiError(429, QUOTA_DAILY_429));

    await expectHttpError(
      service.generateExceptionSummary(),
      429,
      'GEMINI_QUOTA_EXHAUSTED',
    );

    expect(recordSafely).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'AI_INTERACTION',
        action: 'AI_EXCEPTION_SUMMARY',
        after: expect.objectContaining({
          outcome: 'FAILED',
          httpStatus: 429,
          errorCode: 'GEMINI_QUOTA_EXHAUSTED',
        }),
      }),
    );
  });
});
