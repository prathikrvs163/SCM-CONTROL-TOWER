import { configureStore } from '@reduxjs/toolkit';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from '../../services/api';
import plannerReducer, {
  clearPlannerError,
  expediteReceipt,
  overridePromiseDate,
  reassignOrderLine,
  splitOrder,
} from './plannerSlice';

vi.mock('../../services/api', () => ({
  default: {
    post: vi.fn(),
  },
}));

const createStore = () =>
  configureStore({ reducer: { planner: plannerReducer } });

describe('planner Redux slice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('posts an expedite with its reason to the receipt endpoint', async () => {
    const store = createStore();
    vi.mocked(api.post).mockResolvedValue({ data: { id: 'rcpt-1' } } as never);

    await store.dispatch(
      expediteReceipt({
        receiptId: 'rcpt-1',
        expectedArrivalTime: '2026-11-20T09:00:00.000Z',
        reason: 'Air freight',
      }),
    );

    expect(api.post).toHaveBeenCalledWith(
      '/planner-actions/receipts/rcpt-1/expedite',
      { expectedArrivalTime: '2026-11-20T09:00:00.000Z', reason: 'Air freight' },
    );
    expect(store.getState().planner).toEqual({ saving: false, error: null });
  });

  it('posts reassign, override (including clear) and split to their endpoints', async () => {
    const store = createStore();
    vi.mocked(api.post).mockResolvedValue({ data: {} } as never);

    await store.dispatch(
      reassignOrderLine({ orderLineId: 'line-1', warehouseId: 'wh-2', reason: 'Dock closed' }),
    );
    await store.dispatch(
      overridePromiseDate({ orderLineId: 'line-1', promisedShipDate: null, reason: 'Recovered' }),
    );
    await store.dispatch(
      splitOrder({
        orderId: 'order-1',
        lines: [{ orderLineId: 'line-1', quantity: 2 }],
        reason: 'Ship what we have',
      }),
    );

    expect(vi.mocked(api.post).mock.calls).toEqual([
      ['/planner-actions/order-lines/line-1/reassign', { warehouseId: 'wh-2', reason: 'Dock closed' }],
      ['/planner-actions/order-lines/line-1/promise-override', { promisedShipDate: null, reason: 'Recovered' }],
      [
        '/planner-actions/orders/order-1/split',
        { lines: [{ orderLineId: 'line-1', quantity: 2 }], reason: 'Ship what we have' },
      ],
    ]);
  });

  it('keeps the backend error message and clears it on request', async () => {
    const store = createStore();
    vi.mocked(api.post).mockRejectedValue(
      new Error('Receipt changed since it was loaded; reload and retry'),
    );

    await store.dispatch(
      expediteReceipt({ receiptId: 'rcpt-1', expectedArrivalTime: 'x', reason: 'Race' }),
    );

    expect(store.getState().planner).toEqual({
      saving: false,
      error: 'Receipt changed since it was loaded; reload and retry',
    });

    store.dispatch(clearPlannerError());
    expect(store.getState().planner.error).toBeNull();
  });

  it('ignores a second planner action while one is saving', async () => {
    const store = createStore();
    let resolve!: (value: unknown) => void;
    vi.mocked(api.post).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }) as never,
    );

    const first = store.dispatch(
      splitOrder({ orderId: 'order-1', lines: [{ orderLineId: 'l', quantity: 1 }], reason: 'One' }),
    );
    expect(store.getState().planner.saving).toBe(true);

    await store.dispatch(
      splitOrder({ orderId: 'order-1', lines: [{ orderLineId: 'l', quantity: 1 }], reason: 'Two' }),
    );

    resolve({ data: {} });
    await first;

    expect(api.post).toHaveBeenCalledTimes(1);
    expect(store.getState().planner.saving).toBe(false);
  });
});
