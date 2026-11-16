import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  OrderStatus,
  Prisma,
  ReceiptStatus,
} from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AllocationService } from '../allocation/allocation.service.js';
import { AuditEntityType, AuditService } from '../audit/audit.service.js';
import {
  ExpediteReceiptDto,
  OverridePromiseDto,
  ReassignLineDto,
  SplitOrderDto,
} from './dto/planner-actions.dto.js';

/** Orders the allocation engine plans for. */
const PLANNED_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.CONFIRMED,
  OrderStatus.FULFILLING,
];

/** Orders whose lines may still change fulfillment location. */
const REASSIGNABLE_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.DRAFT,
  ...PLANNED_ORDER_STATUSES,
];

const OPEN_RECEIPT_STATUSES: ReceiptStatus[] = [
  ReceiptStatus.PLANNED,
  ReceiptStatus.IN_TRANSIT,
];

const ORDER_INCLUDE = {
  lines: {
    include: {
      sku: true,
      preferredWarehouse: true,
    },
  },
} satisfies Prisma.OrderInclude;

function startOfTodayUtc(now = new Date()): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

/**
 * Planner actions change the inputs of the allocation plan. Each one
 * requires a reason, is guarded against concurrent changes with a
 * conditional update, and writes an audit entry in the same transaction.
 */
@Injectable()
export class PlannerActionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly allocationService: AllocationService,
    private readonly audit: AuditService,
  ) {}

  /** Move a receipt's expected arrival earlier. */
  async expediteReceipt(id: string, dto: ExpediteReceiptDto) {
    const receipt = await this.prisma.inboundReceipt.findUnique({
      where: { id },
    });

    if (!receipt) {
      throw new NotFoundException('Inbound receipt not found');
    }

    if (!OPEN_RECEIPT_STATUSES.includes(receipt.status)) {
      throw new BadRequestException(
        'Only planned or in-transit receipts can be expedited',
      );
    }

    const newEta = new Date(dto.expectedArrivalTime);

    if (newEta.getTime() >= receipt.expectedArrivalTime.getTime()) {
      throw new BadRequestException(
        'An expedited arrival must be earlier than the current expected arrival. Use Edit to move it later.',
      );
    }

    if (newEta.getTime() < Date.now()) {
      throw new BadRequestException(
        'The expedited arrival cannot be in the past',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      // Fails if the receipt was received, canceled or rescheduled
      // since it was read.
      const updated = await tx.inboundReceipt.updateMany({
        where: {
          id,
          status: { in: OPEN_RECEIPT_STATUSES },
          expectedArrivalTime: receipt.expectedArrivalTime,
        },
        data: { expectedArrivalTime: newEta },
      });

      if (updated.count !== 1) {
        throw new ConflictException(
          'Receipt changed since it was loaded; reload and retry',
        );
      }

      await this.audit.record(tx, {
        entityType: AuditEntityType.INBOUND_RECEIPT,
        entityId: id,
        entityRef: receipt.receiptId,
        action: 'RECEIPT_EXPEDITED',
        reason: dto.reason,
        before: { expectedArrivalTime: receipt.expectedArrivalTime },
        after: { expectedArrivalTime: newEta },
      });
    });

    return this.prisma.inboundReceipt.findUnique({
      where: { id },
      include: { sku: true, warehouse: true },
    });
  }

  /**
   * Change the warehouse a line is fulfilled from. The allocation engine
   * draws from this warehouse first and falls back to others only if it
   * cannot cover the quantity.
   */
  async reassignLine(lineId: string, dto: ReassignLineDto) {
    const line = await this.findLine(lineId);

    if (!REASSIGNABLE_ORDER_STATUSES.includes(line.order.status)) {
      throw new BadRequestException(
        `Fulfillment location can only change on draft, confirmed or fulfilling orders (this order is ${line.order.status})`,
      );
    }

    if (line.preferredWarehouseId === dto.warehouseId) {
      throw new BadRequestException(
        'The line is already assigned to that warehouse',
      );
    }

    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id: dto.warehouseId },
    });

    if (!warehouse || !warehouse.isActive) {
      throw new NotFoundException('Active warehouse not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await this.lockOrderStatus(tx, line.orderId, line.order.status);

      const updated = await tx.orderLine.updateMany({
        where: {
          id: lineId,
          preferredWarehouseId: line.preferredWarehouseId,
        },
        data: { preferredWarehouseId: warehouse.id },
      });

      if (updated.count !== 1) {
        throw new ConflictException(
          'Order line changed since it was loaded; reload and retry',
        );
      }

      await this.audit.record(tx, {
        entityType: AuditEntityType.ORDER,
        entityId: line.orderId,
        entityRef: line.order.orderNumber,
        action: 'LINE_FULFILLMENT_REASSIGNED',
        reason: dto.reason,
        before: {
          orderLineId: line.id,
          skuCode: line.sku.skuCode,
          preferredWarehouseCode: line.preferredWarehouse?.code ?? null,
        },
        after: {
          orderLineId: line.id,
          skuCode: line.sku.skuCode,
          preferredWarehouseCode: warehouse.code,
        },
      });
    });

    return this.findOrder(line.orderId);
  }

  /** Set or clear a planner override of a line's promised ship date. */
  async overridePromise(lineId: string, dto: OverridePromiseDto) {
    const line = await this.findLine(lineId);

    if (!PLANNED_ORDER_STATUSES.includes(line.order.status)) {
      throw new BadRequestException(
        `Promise dates can only be overridden on confirmed or fulfilling orders (this order is ${line.order.status})`,
      );
    }

    const newDate =
      dto.promisedShipDate === null ? null : new Date(dto.promisedShipDate);

    if (newDate === null && line.promisedShipDateOverride === null) {
      throw new BadRequestException(
        'This line has no promise override to clear',
      );
    }

    if (newDate !== null && newDate < startOfTodayUtc()) {
      throw new BadRequestException(
        'An overridden promise date cannot be in the past',
      );
    }

    // Record what the engine would promise, so the audit shows the gap.
    const plan = await this.allocationService.getPlan();
    const planLine = plan.orders
      .find((order) => order.orderId === line.orderId)
      ?.lines.find((item) => item.orderLineId === lineId);

    await this.prisma.$transaction(async (tx) => {
      await this.lockOrderStatus(tx, line.orderId, line.order.status);

      const updated = await tx.orderLine.updateMany({
        where: {
          id: lineId,
          promisedShipDateOverride: line.promisedShipDateOverride,
        },
        data: {
          promisedShipDateOverride: newDate,
          promiseOverrideReason: newDate === null ? null : dto.reason,
        },
      });

      if (updated.count !== 1) {
        throw new ConflictException(
          'Order line changed since it was loaded; reload and retry',
        );
      }

      await this.audit.record(tx, {
        entityType: AuditEntityType.ORDER,
        entityId: line.orderId,
        entityRef: line.order.orderNumber,
        action:
          newDate === null
            ? 'PROMISE_OVERRIDE_CLEARED'
            : 'PROMISE_DATE_OVERRIDDEN',
        reason: dto.reason,
        before: {
          orderLineId: line.id,
          skuCode: line.sku.skuCode,
          promisedShipDateOverride: line.promisedShipDateOverride,
          computedPromisedShipDate:
            planLine?.computedPromisedShipDate ?? null,
        },
        after: {
          orderLineId: line.id,
          skuCode: line.sku.skuCode,
          promisedShipDateOverride: newDate,
        },
      });
    });

    return this.findOrder(line.orderId);
  }

  /**
   * Split a shipment: move some quantity of one or more lines to a new
   * order, so the part that can be fulfilled now is not held back by the
   * part that cannot. The new order keeps the original creation time so it
   * keeps its place in the allocation queue.
   */
  async splitOrder(orderId: string, dto: SplitOrderDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: ORDER_INCLUDE,
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (!PLANNED_ORDER_STATUSES.includes(order.status)) {
      throw new BadRequestException(
        `Only confirmed or fulfilling orders can be split (this order is ${order.status})`,
      );
    }

    const requestedIds = dto.lines.map((item) => item.orderLineId);

    if (new Set(requestedIds).size !== requestedIds.length) {
      throw new BadRequestException(
        'Each order line can appear only once in a split',
      );
    }

    const moves = dto.lines.map((item) => {
      const line = order.lines.find((candidate) => candidate.id === item.orderLineId);

      if (!line) {
        throw new BadRequestException(
          `Order line ${item.orderLineId} does not belong to ${order.orderNumber}`,
        );
      }

      if (item.quantity > line.quantity) {
        throw new BadRequestException(
          `Cannot move ${item.quantity} units of ${line.sku.skuCode}; the line has ${line.quantity}`,
        );
      }

      return { line, quantity: item.quantity };
    });

    const totalUnits = order.lines.reduce((sum, line) => sum + line.quantity, 0);
    const movedUnits = moves.reduce((sum, move) => sum + move.quantity, 0);

    if (totalUnits - movedUnits < 1) {
      throw new BadRequestException(
        'At least one unit must stay on the original order',
      );
    }

    const existingSplits = await this.prisma.order.count({
      where: { splitFromOrderId: order.id },
    });
    const splitOrderNumber = `${order.orderNumber}-S${existingSplits + 1}`;

    try {
      const splitOrder = await this.prisma.$transaction(async (tx) => {
        await this.lockOrderStatus(tx, order.id, order.status);

        for (const { line, quantity } of moves) {
          // Guard on the quantity read above so a concurrent edit or split
          // cannot move the same units twice.
          const result =
            quantity === line.quantity
              ? await tx.orderLine.deleteMany({
                  where: { id: line.id, quantity: line.quantity },
                })
              : await tx.orderLine.updateMany({
                  where: { id: line.id, quantity: line.quantity },
                  data: { quantity: line.quantity - quantity },
                });

          if (result.count !== 1) {
            throw new ConflictException(
              'Order lines changed since they were loaded; reload and retry',
            );
          }
        }

        const created = await tx.order.create({
          data: {
            orderNumber: splitOrderNumber,
            customerName: order.customerName,
            priority: order.priority,
            requestedShipDate: order.requestedShipDate,
            status: order.status,
            createdAt: order.createdAt,
            splitFromOrderId: order.id,
            lines: {
              create: moves.map(({ line, quantity }) => ({
                skuId: line.skuId,
                quantity,
                preferredWarehouseId: line.preferredWarehouseId,
              })),
            },
          },
          include: ORDER_INCLUDE,
        });

        await tx.orderStatusHistory.create({
          data: {
            orderId: created.id,
            fromStatus: null,
            toStatus: order.status,
          },
        });

        const movedLines = moves.map(({ line, quantity }) => ({
          orderLineId: line.id,
          skuCode: line.sku.skuCode,
          quantity,
        }));

        await this.audit.record(tx, {
          entityType: AuditEntityType.ORDER,
          entityId: order.id,
          entityRef: order.orderNumber,
          action: 'ORDER_SPLIT',
          reason: dto.reason,
          before: {
            lines: order.lines.map((line) => ({
              orderLineId: line.id,
              skuCode: line.sku.skuCode,
              quantity: line.quantity,
            })),
          },
          after: {
            splitOrderId: created.id,
            splitOrderNumber: created.orderNumber,
            movedLines,
          },
        });

        await this.audit.record(tx, {
          entityType: AuditEntityType.ORDER,
          entityId: created.id,
          entityRef: created.orderNumber,
          action: 'ORDER_CREATED_FROM_SPLIT',
          reason: dto.reason,
          after: {
            splitFromOrderId: order.id,
            splitFromOrderNumber: order.orderNumber,
            status: created.status,
            lines: movedLines,
          },
        });

        return created;
      });

      return {
        originalOrder: await this.findOrder(order.id),
        splitOrder,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          `Order ${splitOrderNumber} already exists; reload and retry`,
        );
      }

      throw error;
    }
  }

  private async findLine(lineId: string) {
    const line = await this.prisma.orderLine.findUnique({
      where: { id: lineId },
      include: { order: true, sku: true, preferredWarehouse: true },
    });

    if (!line) {
      throw new NotFoundException('Order line not found');
    }

    return line;
  }

  private findOrder(orderId: string) {
    return this.prisma.order.findUnique({
      where: { id: orderId },
      include: ORDER_INCLUDE,
    });
  }

  /**
   * Re-check the order status inside the transaction and lock the row, so
   * a concurrent ship or cancel cannot interleave with the planner action.
   */
  private async lockOrderStatus(
    tx: Prisma.TransactionClient,
    orderId: string,
    expectedStatus: OrderStatus,
  ) {
    const locked = await tx.order.updateMany({
      where: { id: orderId, status: expectedStatus },
      data: { updatedAt: new Date() },
    });

    if (locked.count !== 1) {
      throw new ConflictException(
        'Order status changed since it was loaded; reload and retry',
      );
    }
  }
}
