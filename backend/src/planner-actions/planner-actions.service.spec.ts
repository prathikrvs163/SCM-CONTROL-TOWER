import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

import { Prisma } from '../generated/prisma/client.js';
import { PlannerActionsService } from './planner-actions.service.js';
import type { AllocationService } from '../allocation/allocation.service.js';
import type { AuditService } from '../audit/audit.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-11-17T10:00:00.000Z');

function createPrismaMock() {
  const mock = {
    inboundReceipt: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    order: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
    orderLine: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    orderStatusHistory: {
      create: vi.fn(),
    },
    warehouse: {
      findUnique: vi.fn(),
    },
    // Run the callback with the same mock acting as the transaction client.
    $transaction: vi.fn(),
  };

  mock.$transaction.mockImplementation(
    (callback: (tx: typeof mock) => unknown) => callback(mock),
  );

  return mock;
}

function line(overrides: Record<string, unknown> = {}) {
  return {
    id: 'line-1',
    orderId: 'order-1',
    skuId: 'sku-1',
    quantity: 10,
    preferredWarehouseId: 'wh-hyd',
    promisedShipDateOverride: null,
    promiseOverrideReason: null,
    sku: { skuCode: 'SKU-A' },
    preferredWarehouse: { code: 'HYD' },
    order: {
      id: 'order-1',
      orderNumber: 'SO-1',
      status: 'CONFIRMED',
    },
    ...overrides,
  };
}

describe('PlannerActionsService', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let audit: { record: ReturnType<typeof vi.fn> };
  let allocation: { getPlan: ReturnType<typeof vi.fn> };
  let service: PlannerActionsService;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    prisma = createPrismaMock();
    audit = { record: vi.fn().mockResolvedValue(undefined) };
    allocation = { getPlan: vi.fn().mockResolvedValue({ orders: [] }) };

    service = new PlannerActionsService(
      prisma as unknown as PrismaService,
      allocation as unknown as AllocationService,
      audit as unknown as AuditService,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('expediteReceipt', () => {
    const receipt = {
      id: 'rcpt-1',
      receiptId: 'DEMO-RCV-002',
      status: 'IN_TRANSIT',
      expectedArrivalTime: new Date(NOW.getTime() + 10 * DAY),
    };

    it('moves the ETA earlier and audits it with the reason in one transaction', async () => {
      const newEta = new Date(NOW.getTime() + 3 * DAY);
      prisma.inboundReceipt.findUnique
        .mockResolvedValueOnce(receipt)
        .mockResolvedValueOnce({ ...receipt, expectedArrivalTime: newEta });
      prisma.inboundReceipt.updateMany.mockResolvedValue({ count: 1 });

      await service.expediteReceipt('rcpt-1', {
        expectedArrivalTime: newEta.toISOString(),
        reason: 'Supplier agreed to air freight',
      });

      expect(prisma.inboundReceipt.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'rcpt-1',
          status: { in: ['PLANNED', 'IN_TRANSIT'] },
          expectedArrivalTime: receipt.expectedArrivalTime,
        },
        data: { expectedArrivalTime: newEta },
      });
      expect(audit.record).toHaveBeenCalledWith(prisma, {
        entityType: 'INBOUND_RECEIPT',
        entityId: 'rcpt-1',
        entityRef: 'DEMO-RCV-002',
        action: 'RECEIPT_EXPEDITED',
        reason: 'Supplier agreed to air freight',
        before: { expectedArrivalTime: receipt.expectedArrivalTime },
        after: { expectedArrivalTime: newEta },
      });
    });

    it('rejects an ETA that is not earlier than the current one', async () => {
      prisma.inboundReceipt.findUnique.mockResolvedValue(receipt);

      await expect(
        service.expediteReceipt('rcpt-1', {
          expectedArrivalTime: new Date(NOW.getTime() + 11 * DAY).toISOString(),
          reason: 'Later',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects an ETA in the past', async () => {
      prisma.inboundReceipt.findUnique.mockResolvedValue(receipt);

      await expect(
        service.expediteReceipt('rcpt-1', {
          expectedArrivalTime: new Date(NOW.getTime() - DAY).toISOString(),
          reason: 'Backdate',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects received or canceled receipts', async () => {
      prisma.inboundReceipt.findUnique.mockResolvedValue({
        ...receipt,
        status: 'RECEIVED',
      });

      await expect(
        service.expediteReceipt('rcpt-1', {
          expectedArrivalTime: new Date(NOW.getTime() + DAY).toISOString(),
          reason: 'Too late',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('returns 409 and writes no audit entry when the receipt changed concurrently', async () => {
      prisma.inboundReceipt.findUnique.mockResolvedValue(receipt);
      prisma.inboundReceipt.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.expediteReceipt('rcpt-1', {
          expectedArrivalTime: new Date(NOW.getTime() + DAY).toISOString(),
          reason: 'Race',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(audit.record).not.toHaveBeenCalled();
    });

    it('returns 404 for an unknown receipt', async () => {
      prisma.inboundReceipt.findUnique.mockResolvedValue(null);

      await expect(
        service.expediteReceipt('missing', {
          expectedArrivalTime: NOW.toISOString(),
          reason: 'Nope',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('reassignLine', () => {
    it('changes the preferred warehouse under an order-status lock and audits it', async () => {
      prisma.orderLine.findUnique.mockResolvedValue(line());
      prisma.warehouse.findUnique.mockResolvedValue({
        id: 'wh-chn',
        code: 'CHN',
        isActive: true,
      });
      prisma.order.updateMany.mockResolvedValue({ count: 1 });
      prisma.orderLine.updateMany.mockResolvedValue({ count: 1 });

      await service.reassignLine('line-1', {
        warehouseId: 'wh-chn',
        reason: 'HYD dock closed this week',
      });

      expect(prisma.order.updateMany).toHaveBeenCalledWith({
        where: { id: 'order-1', status: 'CONFIRMED' },
        data: { updatedAt: NOW },
      });
      expect(prisma.orderLine.updateMany).toHaveBeenCalledWith({
        where: { id: 'line-1', preferredWarehouseId: 'wh-hyd' },
        data: { preferredWarehouseId: 'wh-chn' },
      });
      expect(audit.record).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({
          entityType: 'ORDER',
          entityId: 'order-1',
          action: 'LINE_FULFILLMENT_REASSIGNED',
          reason: 'HYD dock closed this week',
          before: expect.objectContaining({ preferredWarehouseCode: 'HYD' }),
          after: expect.objectContaining({ preferredWarehouseCode: 'CHN' }),
        }),
      );
    });

    it('rejects shipped or canceled orders', async () => {
      prisma.orderLine.findUnique.mockResolvedValue(
        line({ order: { id: 'order-1', orderNumber: 'SO-1', status: 'SHIPPED' } }),
      );

      await expect(
        service.reassignLine('line-1', { warehouseId: 'wh-chn', reason: 'Late' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an inactive warehouse', async () => {
      prisma.orderLine.findUnique.mockResolvedValue(line());
      prisma.warehouse.findUnique.mockResolvedValue({
        id: 'wh-old',
        code: 'OLD',
        isActive: false,
      });

      await expect(
        service.reassignLine('line-1', { warehouseId: 'wh-old', reason: 'Old' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects reassigning to the same warehouse', async () => {
      prisma.orderLine.findUnique.mockResolvedValue(line());

      await expect(
        service.reassignLine('line-1', { warehouseId: 'wh-hyd', reason: 'Same' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('returns 409 when the order was shipped or canceled concurrently', async () => {
      prisma.orderLine.findUnique.mockResolvedValue(line());
      prisma.warehouse.findUnique.mockResolvedValue({
        id: 'wh-chn',
        code: 'CHN',
        isActive: true,
      });
      prisma.order.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.reassignLine('line-1', { warehouseId: 'wh-chn', reason: 'Race' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.orderLine.updateMany).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });
  });

  describe('overridePromise', () => {
    beforeEach(() => {
      prisma.order.updateMany.mockResolvedValue({ count: 1 });
      prisma.orderLine.updateMany.mockResolvedValue({ count: 1 });
      allocation.getPlan.mockResolvedValue({
        orders: [
          {
            orderId: 'order-1',
            lines: [
              {
                orderLineId: 'line-1',
                computedPromisedShipDate: new Date('2026-11-27T00:00:00Z'),
              },
            ],
          },
        ],
      });
    });

    it('stores the override with its reason and audits the computed date', async () => {
      prisma.orderLine.findUnique.mockResolvedValue(line());

      await service.overridePromise('line-1', {
        promisedShipDate: '2026-11-20T00:00:00.000Z',
        reason: 'Customer accepts partial air shipment',
      });

      expect(prisma.orderLine.updateMany).toHaveBeenCalledWith({
        where: { id: 'line-1', promisedShipDateOverride: null },
        data: {
          promisedShipDateOverride: new Date('2026-11-20T00:00:00.000Z'),
          promiseOverrideReason: 'Customer accepts partial air shipment',
        },
      });
      expect(audit.record).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({
          action: 'PROMISE_DATE_OVERRIDDEN',
          before: expect.objectContaining({
            computedPromisedShipDate: new Date('2026-11-27T00:00:00Z'),
          }),
        }),
      );
    });

    it('clears an existing override when the date is null', async () => {
      const existing = new Date('2026-11-20T00:00:00.000Z');
      prisma.orderLine.findUnique.mockResolvedValue(
        line({
          promisedShipDateOverride: existing,
          promiseOverrideReason: 'Old reason',
        }),
      );

      await service.overridePromise('line-1', {
        promisedShipDate: null,
        reason: 'Supply recovered',
      });

      expect(prisma.orderLine.updateMany).toHaveBeenCalledWith({
        where: { id: 'line-1', promisedShipDateOverride: existing },
        data: { promisedShipDateOverride: null, promiseOverrideReason: null },
      });
      expect(audit.record).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({ action: 'PROMISE_OVERRIDE_CLEARED' }),
      );
    });

    it('rejects clearing when there is no override', async () => {
      prisma.orderLine.findUnique.mockResolvedValue(line());

      await expect(
        service.overridePromise('line-1', {
          promisedShipDate: null,
          reason: 'Nothing',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a date before today (UTC)', async () => {
      prisma.orderLine.findUnique.mockResolvedValue(line());

      await expect(
        service.overridePromise('line-1', {
          promisedShipDate: '2026-11-16T00:00:00.000Z',
          reason: 'Yesterday',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects draft orders, which are not planned yet', async () => {
      prisma.orderLine.findUnique.mockResolvedValue(
        line({ order: { id: 'order-1', orderNumber: 'SO-1', status: 'DRAFT' } }),
      );

      await expect(
        service.overridePromise('line-1', {
          promisedShipDate: '2026-11-20T00:00:00.000Z',
          reason: 'Draft',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('splitOrder', () => {
    const order = {
      id: 'order-1',
      orderNumber: 'SO-1',
      customerName: 'Acme Retail',
      priority: 'HIGH',
      requestedShipDate: new Date('2026-11-20T00:00:00Z'),
      status: 'CONFIRMED',
      createdAt: new Date('2026-11-10T08:00:00Z'),
      lines: [
        line(),
        line({
          id: 'line-2',
          skuId: 'sku-2',
          quantity: 4,
          sku: { skuCode: 'SKU-B' },
        }),
      ],
    };

    beforeEach(() => {
      prisma.order.findUnique.mockResolvedValue(order);
      prisma.order.count.mockResolvedValue(0);
      prisma.order.updateMany.mockResolvedValue({ count: 1 });
      prisma.orderLine.updateMany.mockResolvedValue({ count: 1 });
      prisma.orderLine.deleteMany.mockResolvedValue({ count: 1 });
      prisma.order.create.mockResolvedValue({
        id: 'order-2',
        orderNumber: 'SO-1-S1',
        status: 'CONFIRMED',
      });
    });

    it('moves quantities to a new order that keeps the original queue position', async () => {
      await service.splitOrder('order-1', {
        lines: [
          { orderLineId: 'line-1', quantity: 6 },
          { orderLineId: 'line-2', quantity: 4 },
        ],
        reason: 'Ship available units now',
      });

      // Partial move decrements, full move deletes, both guarded on quantity.
      expect(prisma.orderLine.updateMany).toHaveBeenCalledWith({
        where: { id: 'line-1', quantity: 10 },
        data: { quantity: 4 },
      });
      expect(prisma.orderLine.deleteMany).toHaveBeenCalledWith({
        where: { id: 'line-2', quantity: 4 },
      });

      expect(prisma.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            orderNumber: 'SO-1-S1',
            status: 'CONFIRMED',
            priority: 'HIGH',
            createdAt: order.createdAt,
            splitFromOrderId: 'order-1',
            lines: {
              create: [
                { skuId: 'sku-1', quantity: 6, preferredWarehouseId: 'wh-hyd' },
                { skuId: 'sku-2', quantity: 4, preferredWarehouseId: 'wh-hyd' },
              ],
            },
          }),
        }),
      );
      expect(prisma.orderStatusHistory.create).toHaveBeenCalledWith({
        data: { orderId: 'order-2', fromStatus: null, toStatus: 'CONFIRMED' },
      });

      const actions = audit.record.mock.calls.map(
        ([, entry]) => (entry as { action: string }).action,
      );
      expect(actions).toEqual(['ORDER_SPLIT', 'ORDER_CREATED_FROM_SPLIT']);
    });

    it('numbers further splits sequentially', async () => {
      prisma.order.count.mockResolvedValue(2);

      await service.splitOrder('order-1', {
        lines: [{ orderLineId: 'line-1', quantity: 1 }],
        reason: 'Third split',
      });

      expect(prisma.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ orderNumber: 'SO-1-S3' }),
        }),
      );
    });

    it('requires at least one unit to stay on the original order', async () => {
      await expect(
        service.splitOrder('order-1', {
          lines: [
            { orderLineId: 'line-1', quantity: 10 },
            { orderLineId: 'line-2', quantity: 4 },
          ],
          reason: 'Everything',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects moving more than the line quantity', async () => {
      await expect(
        service.splitOrder('order-1', {
          lines: [{ orderLineId: 'line-2', quantity: 5 }],
          reason: 'Too many',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects lines from another order and duplicate lines', async () => {
      await expect(
        service.splitOrder('order-1', {
          lines: [{ orderLineId: 'other-line', quantity: 1 }],
          reason: 'Wrong order',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      await expect(
        service.splitOrder('order-1', {
          lines: [
            { orderLineId: 'line-1', quantity: 1 },
            { orderLineId: 'line-1', quantity: 1 },
          ],
          reason: 'Duplicate',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects orders that are not confirmed or fulfilling', async () => {
      prisma.order.findUnique.mockResolvedValue({ ...order, status: 'SHIPPED' });

      await expect(
        service.splitOrder('order-1', {
          lines: [{ orderLineId: 'line-1', quantity: 1 }],
          reason: 'Shipped',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('returns 409 and creates nothing when a line changed concurrently', async () => {
      prisma.orderLine.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.splitOrder('order-1', {
          lines: [{ orderLineId: 'line-1', quantity: 2 }],
          reason: 'Race',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.order.create).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });

    it('maps a duplicate split order number to 409', async () => {
      prisma.order.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );

      await expect(
        service.splitOrder('order-1', {
          lines: [{ orderLineId: 'line-1', quantity: 2 }],
          reason: 'Duplicate number',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });
});
