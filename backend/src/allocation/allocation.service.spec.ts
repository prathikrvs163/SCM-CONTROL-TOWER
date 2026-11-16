import { AllocationService } from './allocation.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';

const NOW = new Date('2026-11-17T10:00:00.000Z');
const TODAY = new Date('2026-11-17T00:00:00.000Z');

function createService(lineOverrides: Record<string, unknown>, onHand: number) {
  const prisma = {
    order: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: 'order-1',
          orderNumber: 'SO-1',
          customerName: 'Acme Retail',
          priority: 'HIGH',
          status: 'CONFIRMED',
          requestedShipDate: new Date('2026-11-18T00:00:00.000Z'),
          createdAt: new Date('2026-11-10T00:00:00.000Z'),
          lines: [
            {
              id: 'line-1',
              skuId: 'sku-1',
              quantity: 5,
              preferredWarehouseId: null,
              promisedShipDateOverride: null,
              promiseOverrideReason: null,
              sku: { skuCode: 'SKU-A', name: 'Widget' },
              ...lineOverrides,
            },
          ],
        },
      ]),
    },
    warehouse: {
      findMany: vi
        .fn()
        .mockResolvedValue([{ id: 'wh-1', code: 'HYD', isActive: true }]),
    },
    inventory: {
      findMany: vi.fn().mockResolvedValue([
        {
          skuId: 'sku-1',
          warehouseId: 'wh-1',
          onHandQuantity: onHand,
          safetyStock: 0,
        },
      ]),
    },
    inboundReceipt: { findMany: vi.fn().mockResolvedValue([]) },
  };

  return new AllocationService(prisma as unknown as PrismaService);
}

describe('AllocationService promise overrides', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses the computed promise when there is no override', async () => {
    const plan = await createService({}, 10).getPlan();
    const [line] = plan.orders[0].lines;

    expect(line.promisedShipDate).toEqual(TODAY);
    expect(line.computedPromisedShipDate).toEqual(TODAY);
    expect(line.promiseOverridden).toBe(false);
    expect(line.promiseReason).toBe('Fulfilled from available on-hand inventory.');
  });

  it('replaces the promise with the override, keeps the computed date and flags lateness from the override', async () => {
    const override = new Date('2026-11-25T00:00:00.000Z');

    const plan = await createService(
      {
        promisedShipDateOverride: override,
        promiseOverrideReason: 'Customer asked to consolidate',
      },
      10,
    ).getPlan();
    const [line] = plan.orders[0].lines;

    expect(line.promisedShipDate).toEqual(override);
    expect(line.computedPromisedShipDate).toEqual(TODAY);
    expect(line.promiseOverridden).toBe(true);
    expect(line.isLate).toBe(true);
    expect(line.promiseReason).toBe(
      'Planner override: Customer asked to consolidate',
    );
  });

  it('still reports the backorder when an override covers a short line', async () => {
    const override = new Date('2026-11-18T00:00:00.000Z');

    const plan = await createService(
      {
        promisedShipDateOverride: override,
        promiseOverrideReason: 'Expedite agreed',
      },
      2,
    ).getPlan();
    const [line] = plan.orders[0].lines;

    expect(line.backorderedQuantity).toBe(3);
    expect(line.computedPromisedShipDate).toBeNull();
    expect(line.promisedShipDate).toEqual(override);
    expect(line.promiseReason).toBe(
      'Planner override: Expedite agreed (current supply does not cover the full quantity)',
    );
  });
});
