import { describe, expect, it } from 'vitest';
import {
  AI_ERROR_TEXT,
  getAiErrorMessage,
} from './aiErrors';

describe('getAiErrorMessage', () => {
  it('returns generic message for non-Error values', () => {
    expect(getAiErrorMessage('failure')).toBe(AI_ERROR_TEXT.GENERIC);
    expect(getAiErrorMessage(null)).toBe(AI_ERROR_TEXT.GENERIC);
  });

  it.each([
    ['GEMINI_QUOTA_EXHAUSTED', AI_ERROR_TEXT.QUOTA_EXHAUSTED],
    ['GEMINI_RATE_LIMITED', AI_ERROR_TEXT.RATE_LIMITED],
    ['GEMINI_UNAVAILABLE', AI_ERROR_TEXT.UNAVAILABLE],
    ['GEMINI_TIMEOUT', AI_ERROR_TEXT.TIMEOUT],
  ])('maps %s correctly', (errorCode, expected) => {
    const error = Object.assign(new Error('Backend error'), { errorCode });
    expect(getAiErrorMessage(error)).toBe(expected);
  });

  it.each(['ECONNABORTED', 'ETIMEDOUT'])(
    'maps timeout code %s correctly',
    (code) => {
      const error = Object.assign(new Error('Request failed'), { code });
      expect(getAiErrorMessage(error)).toBe(AI_ERROR_TEXT.TIMEOUT);
    },
  );

  it('maps ERR_NETWORK correctly', () => {
    const error = Object.assign(new Error('Network Error'), {
      code: 'ERR_NETWORK',
    });
    expect(getAiErrorMessage(error)).toBe(
      AI_ERROR_TEXT.SERVER_UNREACHABLE,
    );
  });

  it('preserves backend messages for other HTTP errors', () => {
    const error = Object.assign(new Error('Order not found'), {
      status: 404,
    });
    expect(getAiErrorMessage(error)).toBe('Order not found');
  });

  it('uses generic message when error has no message', () => {
    expect(getAiErrorMessage(new Error(''))).toBe(AI_ERROR_TEXT.GENERIC);
  });
});
