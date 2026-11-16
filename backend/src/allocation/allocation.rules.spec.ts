import { AllocationService } from './allocation.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';

/**
 * Rule-level tests for the allocation engine and ATP. Prisma is mocked;
 * mocks return rows in the order the real queries request (receipts by
 * ETA then receiptId, warehouses by code, lines by createdAt), while
 * orders are deliberately returned unsorted because the engine sorts them.
 */

const NOW = new Date('2026-11-17T10:00:00.000Z');
const TODAY = new Date('2026-11-17T00:00:00.000Z');
const day = (offset: number) =>
  new Date(TODAY.getTime() + offset * 24 * 60 * 60 * 1000);

const WAREHOUSES = {
  BLR: { id: 'wh-blr', code: 'BLR', name: 'Bengaluru', isActive: true },
  CHN: { id: 'wh-chn', code: 'CHN', name: 'Chennai', isActive: true },
  HYD: { id: 'wh-hyd', code: 'HYD', name: 'Hyderabad', isActive: true },
};
type WarehouseCode = keyof typeof WAREHOUSES;

const SKUS = {
  A: { id: 'sku-a', skuCode: 'SKU-A', name: 'Widget A' },
  B: { id: 'sku-b', skuCode: 'SKU-B', name: 'Widget B' },
};
type SkuKey = keyof typeof SKUS;

function line(
  id: string,
  sku: SkuKey,
  quantity: number,
  preferred: WarehouseCode | null = null,
) {
  return {
    id,
    skuId: SKUS[sku].id,
    quantity,
    preferredWarehouseId: preferred ? WAREHOUSES[preferred].id : null,
    promisedShipDateOverride: null,
    promiseOverrideReason: null,
    sku: SKUS[sku],
  };
}

function order(
  id: string,
  lines: ReturnType<typeof line>[],
  options: {
    priority?: 'HIGH' | 'MED' | 'LOW';
    createdAt?: Date;
    orderNumber?: string;
    requestedShipDate?: Date | null;
    status?: 'CONFIRMED' | 'FULFILLING';
  } = {},
) {
  return {
    id,
    orderNumber: options.orderNumber ?? id,
    customerName: `Customer ${id}`,
    priority: options.priority ?? 'MED',
    status: options.status ?? 'CONFIRMED',
    requestedShipDate: options.requestedShipDate ?? null,
    createdAt: options.createdAt ?? day(-5),
    lines,
  };
}

function inventory(
  sku: SkuKey,
  warehouse: WarehouseCode,
  onHandQuantity: number,
  safetyStock = 0,
  warehouseOverride?: Partial<(typeof WAREHOUSES)[WarehouseCode]>,
) {
  const wh = { ...WAREHOUSES[warehouse], ...warehouseOverride };
  return {
    skuId: SKUS[sku].id,
    warehouseId: wh.id,
    onHandQuantity,
    safetyStock,
    sku: SKUS[sku],
    warehouse: wh,
  };
}

function receipt(
  receiptId: string,
  sku: SkuKey,
  warehouse: WarehouseCode,
  quantity: number,
  expectedArrivalTime: Date,
) {
  return {
    id: `id-${receiptId}`,
    receiptId,
    skuId: SKUS[sku].id,
    warehouseId: WAREHOUSES[warehouse].id,
    quantity,
    expectedArrivalTime,
    sku: SKUS[sku],
    warehouse: WAREHOUSES[warehouse],
  };
}

function createService(data: {
  orders?: ReturnType<typeof order>[];
  warehouses?: WarehouseCode[];
  inventories?: ReturnType<typeof inventory>[];
  receipts?: ReturnType<typeof receipt>[];
}) {
  const prisma = {
    order: { findMany: vi.fn().mockResolvedValue(data.orders ?? []) },
    warehouse: {
      findMany: vi
        .fn()
        .mockResolvedValue(
          (data.warehouses ?? ['BLR', 'CHN', 'HYD']).map(
            (code) => WAREHOUSES[code],
          ),
        ),
    },
    inventory: { findMany: vi.fn().mockResolvedValue(data.inventories ?? []) },
    inboundReceipt: {
      findMany: vi.fn().mockResolvedValue(data.receipts ?? []),
    },
  };

  return {
    prisma,
    service: new AllocationService(prisma as unknown as PrismaService),
  };
}

async function planFor(data: Parameters<typeof createService>[0]) {
  const plan = await createService(data).service.getPlan();
  const byOrder = (orderId: string) => {
    const found = plan.orders.find((item) => item.orderId === orderId);
    if (!found) throw new Error(`Order ${orderId} missing from plan`);
    return found;
  };
  return { plan, byOrder, line: (orderId: string) => byOrder(orderId).lines[0] };
}

describe('AllocationService rules', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('what the plan reads', () => {
    it('plans only CONFIRMED/FULFILLING orders, active warehouses and open receipts', async () => {
      const { prisma, service } = createService({});

      await service.getPlan();

      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: { in: ['CONFIRMED', 'FULFILLING'] } },
        }),
      );
      expect(prisma.warehouse.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { code: 'asc' },
      });
      expect(prisma.inboundReceipt.findMany).toHaveBeenCalledWith({
        where: { status: { in: ['PLANNED', 'IN_TRANSIT'] } },
        orderBy: [{ expectedArrivalTime: 'asc' }, { receiptId: 'asc' }],
      });
    });

    it('never allocates stock held in a warehouse that is not active', async () => {
      const { line: lineOf } = await planFor({
        warehouses: ['BLR'],
        inventories: [inventory('A', 'HYD', 50)],
        orders: [order('o1', [line('l1', 'A', 5)])],
      });

      expect(lineOf('o1').allocatedQuantity).toBe(0);
      expect(lineOf('o1').backorderedQuantity).toBe(5);
    });
  });

  describe('tie-breakers for scarce supply', () => {
    it('gives the last units to HIGH priority even when a LOW order is older', async () => {
      const { line: lineOf, plan } = await planFor({
        inventories: [inventory('A', 'BLR', 5)],
        orders: [
          order('low', [line('l-low', 'A', 5)], { priority: 'LOW', createdAt: day(-10) }),
          order('high', [line('l-high', 'A', 5)], { priority: 'HIGH', createdAt: day(-1) }),
        ],
      });

      expect(plan.orders.map((item) => item.orderId)).toEqual(['high', 'low']);
      expect(lineOf('high').allocatedQuantity).toBe(5);
      expect(lineOf('low').backorderedQuantity).toBe(5);
    });

    it('breaks a priority tie by creation time, oldest first', async () => {
      const { line: lineOf } = await planFor({
        inventories: [inventory('A', 'BLR', 5)],
        orders: [
          order('newer', [line('l-new', 'A', 5)], { createdAt: day(-1) }),
          order('older', [line('l-old', 'A', 5)], { createdAt: day(-3) }),
        ],
      });

      expect(lineOf('older').allocatedQuantity).toBe(5);
      expect(lineOf('newer').allocatedQuantity).toBe(0);
    });

    it('breaks a full tie by order number', async () => {
      const createdAt = day(-2);
      const { line: lineOf } = await planFor({
        inventories: [inventory('A', 'BLR', 5)],
        orders: [
          order('o2', [line('l2', 'A', 5)], { createdAt, orderNumber: 'SO-002' }),
          order('o1', [line('l1', 'A', 5)], { createdAt, orderNumber: 'SO-001' }),
        ],
      });

      expect(lineOf('o1').allocatedQuantity).toBe(5);
      expect(lineOf('o2').allocatedQuantity).toBe(0);
    });

    it('allocates lines in order, so a later line of the same SKU gets the remainder', async () => {
      const { byOrder } = await planFor({
        inventories: [inventory('A', 'BLR', 7)],
        orders: [order('o1', [line('first', 'A', 5), line('second', 'A', 5)])],
      });

      const [first, second] = byOrder('o1').lines;
      expect(first.allocatedQuantity).toBe(5);
      expect(second.allocatedQuantity).toBe(2);
      expect(second.backorderedQuantity).toBe(3);
    });
  });

  describe('warehouse and source order', () => {
    it('uses the preferred warehouse first, then the others by code', async () => {
      const { line: lineOf } = await planFor({
        inventories: [
          inventory('A', 'BLR', 3),
          inventory('A', 'CHN', 3),
          inventory('A', 'HYD', 3),
        ],
        orders: [order('o1', [line('l1', 'A', 8, 'HYD')])],
      });

      expect(
        lineOf('o1').allocations.map((item) => [item.warehouseCode, item.quantity]),
      ).toEqual([
        ['HYD', 3],
        ['BLR', 3],
        ['CHN', 2],
      ]);
      expect(lineOf('o1').fulfillmentWarehouseIds).toEqual([
        'wh-hyd',
        'wh-blr',
        'wh-chn',
      ]);
    });

    it('takes on-hand before receipts, and receipts by ETA, within a warehouse', async () => {
      const { line: lineOf } = await planFor({
        inventories: [inventory('A', 'BLR', 2)],
        receipts: [
          receipt('R-EARLY', 'A', 'BLR', 3, day(2)),
          receipt('R-LATE', 'A', 'BLR', 10, day(6)),
        ],
        orders: [order('o1', [line('l1', 'A', 7)])],
      });

      expect(
        lineOf('o1').allocations.map((item) => [item.source, item.receiptId, item.quantity]),
      ).toEqual([
        ['ON_HAND', null, 2],
        ['INBOUND_RECEIPT', 'R-EARLY', 3],
        ['INBOUND_RECEIPT', 'R-LATE', 2],
      ]);
    });

    it("exhausts the preferred warehouse's inbound before another warehouse's on-hand (greedy)", async () => {
      const { line: lineOf } = await planFor({
        inventories: [inventory('A', 'BLR', 10)],
        receipts: [receipt('R-HYD', 'A', 'HYD', 5, day(4))],
        orders: [order('o1', [line('l1', 'A', 5, 'HYD')])],
      });

      expect(lineOf('o1').allocations).toEqual([
        expect.objectContaining({ warehouseCode: 'HYD', source: 'INBOUND_RECEIPT', quantity: 5 }),
      ]);
      expect(lineOf('o1').promisedShipDate).toEqual(day(4));
    });
  });

  describe('safety stock', () => {
    it('never promises the safety stock', async () => {
      const { line: lineOf } = await planFor({
        inventories: [inventory('A', 'BLR', 10, 4)],
        orders: [order('o1', [line('l1', 'A', 8)])],
      });

      expect(lineOf('o1').allocatedQuantity).toBe(6);
      expect(lineOf('o1').backorderedQuantity).toBe(2);
    });

    it('uses incoming receipts to refill a safety-stock deficit before promising them', async () => {
      const { line: lineOf } = await planFor({
        // On-hand 2 against safety 5: a deficit of 3.
        inventories: [inventory('A', 'BLR', 2, 5)],
        receipts: [receipt('R1', 'A', 'BLR', 10, day(3))],
        orders: [order('o1', [line('l1', 'A', 10)])],
      });

      expect(lineOf('o1').allocations).toEqual([
        expect.objectContaining({ source: 'INBOUND_RECEIPT', receiptId: 'R1', quantity: 7 }),
      ]);
      expect(lineOf('o1').backorderedQuantity).toBe(3);
    });
  });

  describe('promise date, reason and lateness', () => {
    it('promises the planning date when on-hand covers the line', async () => {
      const { line: lineOf } = await planFor({
        inventories: [inventory('A', 'BLR', 5)],
        orders: [order('o1', [line('l1', 'A', 5)])],
      });

      expect(lineOf('o1').promisedShipDate).toEqual(TODAY);
      expect(lineOf('o1').promiseReason).toBe(
        'Fulfilled from available on-hand inventory.',
      );
    });

    it('promises the latest ETA among the receipts the line uses', async () => {
      const { line: lineOf } = await planFor({
        receipts: [
          receipt('R1', 'A', 'BLR', 2, day(2)),
          receipt('R2', 'A', 'BLR', 2, day(9)),
        ],
        orders: [order('o1', [line('l1', 'A', 4)])],
      });

      expect(lineOf('o1').promisedShipDate).toEqual(day(9));
      expect(lineOf('o1').promiseReason).toBe(
        'Fulfillment depends on inbound inventory.',
      );
    });

    it('never promises a date before the planning date for an overdue receipt', async () => {
      const { line: lineOf } = await planFor({
        receipts: [receipt('R-OVERDUE', 'A', 'BLR', 5, day(-3))],
        orders: [order('o1', [line('l1', 'A', 5)])],
      });

      expect(lineOf('o1').promisedShipDate).toEqual(TODAY);
    });

    it('promises no date for a backordered line and does not flag it late', async () => {
      const { line: lineOf } = await planFor({
        inventories: [inventory('A', 'BLR', 1)],
        orders: [
          order('o1', [line('l1', 'A', 5)], { requestedShipDate: day(-1) }),
        ],
      });

      expect(lineOf('o1').promisedShipDate).toBeNull();
      expect(lineOf('o1').isLate).toBe(false);
      expect(lineOf('o1').promiseReason).toBe(
        'Insufficient on-hand and inbound supply to cover the full quantity.',
      );
    });

    it('flags a line late only when the promise is after the requested date', async () => {
      const { line: lineOf } = await planFor({
        receipts: [
          receipt('R1', 'A', 'BLR', 5, day(5)),
          receipt('R2', 'B', 'BLR', 5, day(5)),
        ],
        orders: [
          order('late', [line('l-late', 'A', 5)], { requestedShipDate: day(4) }),
          order('on-time', [line('l-ok', 'B', 5)], { requestedShipDate: day(5) }),
        ],
      });

      expect(lineOf('late').isLate).toBe(true);
      expect(lineOf('on-time').isLate).toBe(false);
    });
  });
});

describe('AllocationService ATP', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('nets active allocations and safety stock out of available-now', async () => {
    const { service } = createService({
      inventories: [inventory('A', 'BLR', 20, 5)],
      orders: [order('o1', [line('l1', 'A', 8)])],
    });

    const { atp } = await service.getAtp();

    expect(atp).toEqual([
      expect.objectContaining({
        skuCode: 'SKU-A',
        warehouseCode: 'BLR',
        onHandQuantity: 20,
        allocatedOnHandQuantity: 8,
        safetyStock: 5,
        availableNow: 7,
      }),
    ]);
  });

  it('never reports negative availability when on-hand is below safety stock', async () => {
    const { service } = createService({
      inventories: [inventory('A', 'BLR', 2, 5)],
    });

    const { atp } = await service.getAtp();

    expect(atp[0].availableNow).toBe(0);
  });

  it('projects ATP at each receipt arrival, net of allocations and safety stock', async () => {
    const { service } = createService({
      inventories: [inventory('A', 'BLR', 4, 6)],
      receipts: [
        receipt('R1', 'A', 'BLR', 10, day(2)),
        receipt('R2', 'A', 'BLR', 5, day(6)),
      ],
      // Deficit 2 is refilled from R1, then the order takes 3 of R1.
      orders: [order('o1', [line('l1', 'A', 3)])],
    });

    const [pool] = (await service.getAtp()).atp;

    expect(pool.futureReceipts).toEqual([
      expect.objectContaining({ receiptId: 'R1', allocatedQuantity: 3, remainingQuantity: 7 }),
      expect.objectContaining({ receiptId: 'R2', allocatedQuantity: 0, remainingQuantity: 5 }),
    ]);
    // 4 on hand + 7 + 5, less safety stock 6.
    expect(pool.projectedAtp).toEqual([
      { asOf: day(2), receiptId: 'R1', projectedAvailableQuantity: 5 },
      { asOf: day(6), receiptId: 'R2', projectedAvailableQuantity: 10 },
    ]);
  });

  it('drops receipts that are fully allocated from the projection', async () => {
    const { service } = createService({
      receipts: [receipt('R1', 'A', 'BLR', 5, day(2))],
      orders: [order('o1', [line('l1', 'A', 5)])],
    });

    const [pool] = (await service.getAtp()).atp;

    expect(pool.futureReceipts).toEqual([]);
    expect(pool.projectedAtp).toEqual([]);
  });

  it('skips inactive warehouses and sorts by SKU then warehouse code', async () => {
    const { service } = createService({
      inventories: [
        inventory('B', 'BLR', 1),
        inventory('A', 'HYD', 1),
        inventory('A', 'BLR', 1),
        inventory('A', 'CHN', 9, 0, { isActive: false }),
      ],
    });

    const result = await service.getAtp();

    expect(result.atp.map((item) => `${item.skuCode}@${item.warehouseCode}`)).toEqual([
      'SKU-A@BLR',
      'SKU-A@HYD',
      'SKU-B@BLR',
    ]);
    expect(result.itemCount).toBe(3);
    expect(result.locationCount).toBe(2);
  });
});
