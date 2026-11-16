import { configureStore } from '@reduxjs/toolkit';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from '../../services/api';
import {
  clearAiErrors,
  clearCustomerCommunication,
  generateCustomerCommunication,
  generateExceptionSummary,
  default as aiReducer,
} from './aiSlice';

vi.mock('../../services/api', () => ({
  default: {
    post: vi.fn(),
  },
}));

const createStore = () =>
  configureStore({
    reducer: {
      ai: aiReducer,
    },
  });

describe('AI Redux slice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('stores an exception summary after a successful request', async () => {
    const store = createStore();

    const summary = {
      generatedAt: '2026-11-16T10:00:00Z',
      exceptionCount: 3,
      summary: 'Three inventory exceptions require attention.',
    };

    vi.mocked(api.post).mockResolvedValue({ data: summary } as never);

    await store.dispatch(generateExceptionSummary());

    expect(store.getState().ai.exceptionSummary).toEqual(summary);
    expect(store.getState().ai.summaryLoading).toBe(false);
    expect(store.getState().ai.summaryError).toBeNull();
  });

  it('sets loading state while generating an exception summary', async () => {
    const store = createStore();

    let resolveRequest!: (value: { data: unknown }) => void;

    vi.mocked(api.post).mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }) as never,
    );

    const request = store.dispatch(generateExceptionSummary());

    expect(store.getState().ai.summaryLoading).toBe(true);

    resolveRequest({
      data: {
        generatedAt: '2026-11-16T10:00:00Z',
        exceptionCount: 0,
        summary: 'No exceptions.',
      },
    });

    await request;

    expect(store.getState().ai.summaryLoading).toBe(false);
  });

  it('stores a mapped error when exception summary generation fails', async () => {
    const store = createStore();

    vi.mocked(api.post).mockRejectedValue(
      Object.assign(new Error('Quota exceeded'), {
        errorCode: 'GEMINI_QUOTA_EXHAUSTED',
      }),
    );

    await store.dispatch(generateExceptionSummary());

    expect(store.getState().ai.summaryError).toBe(
      'Gemini daily request quota exhausted. Try again after the quota resets.',
    );
    expect(store.getState().ai.summaryLoading).toBe(false);
  });

  it('stores customer communication after a successful request', async () => {
    const store = createStore();

    const communication = {
      orderId: 'order-123',
      orderNumber: 'SCM-TEST-001',
      customerName: 'Test Customer',
      generatedAt: '2026-11-16T10:00:00Z',
      draft: 'Your order is being processed.',
    };

    vi.mocked(api.post).mockResolvedValue({
      data: communication,
    } as never);

    await store.dispatch(generateCustomerCommunication('order-123'));

    expect(store.getState().ai.customerCommunication).toEqual(
      communication,
    );
    expect(store.getState().ai.communicationLoading).toBe(false);
    expect(store.getState().ai.communicationError).toBeNull();
  });

  it('clears AI errors', () => {
    const state = {
      ...aiReducer(undefined, { type: 'init' }),
      summaryError: 'Summary failed',
      communicationError: 'Communication failed',
    };

    const updated = aiReducer(state, clearAiErrors());

    expect(updated.summaryError).toBeNull();
    expect(updated.communicationError).toBeNull();
  });

  it('clears customer communication and its error', () => {
    const state = {
      ...aiReducer(undefined, { type: 'init' }),
      customerCommunication: {
        orderId: 'order-123',
        orderNumber: 'SCM-TEST-001',
        customerName: 'Test Customer',
        generatedAt: '2026-11-16T10:00:00Z',
        draft: 'Test draft',
      },
      communicationError: 'Previous error',
    };

    const updated = aiReducer(state, clearCustomerCommunication());

    expect(updated.customerCommunication).toBeNull();
    expect(updated.communicationError).toBeNull();
  });
});
