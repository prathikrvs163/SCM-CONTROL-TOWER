/**
 * User-facing messages for AI request failures.
 *
 * The backend tags Gemini failures with a stable `errorCode`
 * (AI_ERROR_MESSAGES in backend/src/ai/ai.service.ts). We map on that code
 * rather than on HTTP status alone, because a 503 can also mean "AI service
 * not configured", which is not a Gemini demand problem.
 *
 * This module has no imports so it can be unit-tested in isolation.
 */
export const AI_ERROR_TEXT = {
  QUOTA_EXHAUSTED:
    'Gemini daily request quota exhausted. Try again after the quota resets.',
  RATE_LIMITED:
    'Gemini per-minute request limit reached. Please wait a minute and try again.',
  UNAVAILABLE:
    'Gemini is temporarily unavailable due to high demand. Please try again later.',
  TIMEOUT: 'The AI request took too long. Please try again later.',
  SERVER_UNREACHABLE:
    'Unable to reach the server. Check that the backend is running, then try again.',
  GENERIC: 'Something went wrong. Please try again.',
} as const;

/** Shape of errors produced by the Axios interceptor in services/api.ts. */
export interface ApiRequestError extends Error {
  status?: number;
  code?: string;
  errorCode?: string;
}

export function getAiErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return AI_ERROR_TEXT.GENERIC;
  }

  const { status, code, errorCode } = error as ApiRequestError;

  // 1. Classified Gemini failures reported by the backend.
  switch (errorCode) {
    case 'GEMINI_QUOTA_EXHAUSTED':
      return AI_ERROR_TEXT.QUOTA_EXHAUSTED;
    case 'GEMINI_RATE_LIMITED':
      return AI_ERROR_TEXT.RATE_LIMITED;
    case 'GEMINI_UNAVAILABLE':
      return AI_ERROR_TEXT.UNAVAILABLE;
    case 'GEMINI_TIMEOUT':
      return AI_ERROR_TEXT.TIMEOUT;
  }

  // 2. No HTTP response at all: the browser gave up or never connected.
  //    This is a client-side condition, not a Gemini provider error.
  if (status === undefined) {
    if (code === 'ECONNABORTED' || code === 'ETIMEDOUT') {
      return AI_ERROR_TEXT.TIMEOUT;
    }

    if (code === 'ERR_NETWORK') {
      return AI_ERROR_TEXT.SERVER_UNREACHABLE;
    }
  }

  // 3. Any other HTTP error (404 order not found, 503 not configured, 502...):
  //    show the backend's own message.
  return error.message || AI_ERROR_TEXT.GENERIC;
}
