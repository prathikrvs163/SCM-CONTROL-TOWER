import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { UpdateOrderDto } from './dto/update-order.dto.js';
import { AllocationService } from '../allocation/allocation.service.js';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly allocationService: AllocationService,
  ) {}

  private readonly orderInclude = {
    lines: {
      include: {
        sku: true,
        preferredWarehouse: true,
      },
    },
  };

  private async validateLines(
    lines: {
      skuId: string;
      quantity: number;
      preferredWarehouseId?: string;
    }[],
  ) {
    const skuIds = [...new Set(lines.map((line) => line.skuId))];

    const warehouseIds = [
      ...new Set(
        lines
          .map((line) => line.preferredWarehouseId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    const skus = await this.prisma.sKU.findMany({
      where: {
        id: { in: skuIds },
        isActive: true,
      },
      select: { id: true },
    });

    if (skus.length !== skuIds.length) {
      throw new NotFoundException(
        'One or more active SKUs were not found',
      );
    }

    if (warehouseIds.length > 0) {
      const warehouses = await this.prisma.warehouse.findMany({
        where: {
          id: { in: warehouseIds },
          isActive: true,
        },
        select: { id: true },
      });

      if (warehouses.length !== warehouseIds.length) {
        throw new NotFoundException(
          'One or more active preferred warehouses were not found',
        );
      }
    }
  }

  async create(dto: CreateOrderDto) {
    await this.validateLines(dto.lines);

    try {
      return await this.prisma.order.create({
        data: {
          orderNumber: dto.orderNumber.trim(),
          customerName: dto.customerName.trim(),
          priority: dto.priority ?? 'MED',
          requestedShipDate: dto.requestedShipDate
            ? new Date(dto.requestedShipDate)
            : undefined,
          lines: {
            create: dto.lines.map((line) => ({
              skuId: line.skuId,
              quantity: line.quantity,
              preferredWarehouseId: line.preferredWarehouseId,
            })),
          },
        },
        include: this.orderInclude,
      });
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Order number already exists',
        );
      }

      throw error;
    }
  }

  async findAll() {
    return this.prisma.order.findMany({
      include: this.orderInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: this.orderInclude,
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  async update(id: string, dto: UpdateOrderDto) {
    const order = await this.prisma.order.findUnique({
      where: { id },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status !== 'DRAFT') {
      throw new BadRequestException(
        'Only draft orders can be edited',
      );
    }

    if (dto.lines) {
      await this.validateLines(dto.lines);
    }

    return this.prisma.$transaction(async (tx) => {
      const updateResult = await tx.order.updateMany({
        where: {
          id,
          status: 'DRAFT',
        },
        data: {
          customerName: dto.customerName?.trim(),
          priority: dto.priority,
          requestedShipDate:
            dto.requestedShipDate === undefined
              ? undefined
              : new Date(dto.requestedShipDate),
        },
      });

      if (updateResult.count === 0) {
        throw new BadRequestException(
          'Order is no longer a draft and cannot be edited',
        );
      }

      if (dto.lines) {
        await tx.orderLine.deleteMany({
          where: { orderId: id },
        });

        await tx.orderLine.createMany({
          data: dto.lines.map((line) => ({
            orderId: id,
            skuId: line.skuId,
            quantity: line.quantity,
            preferredWarehouseId: line.preferredWarehouseId,
          })),
        });
      }

      return tx.order.findUnique({
        where: { id },
        include: this.orderInclude,
      });
    });
  }

  async updateStatus(
    id: string,
    status: 'CONFIRMED' | 'FULFILLING' | 'SHIPPED' | 'CANCELED',
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        orderNumber: true,
        status: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const allowedTransitions: Record<string, string[]> = {
      DRAFT: ['CONFIRMED', 'CANCELED'],
      CONFIRMED: ['FULFILLING', 'CANCELED'],
      FULFILLING: ['SHIPPED', 'CANCELED'],
      SHIPPED: [],
      CANCELED: [],
    };

    if (!allowedTransitions[order.status]?.includes(status)) {
      throw new BadRequestException(
        `Invalid order status transition: ${order.status} to ${status}`,
      );
    }

    // Shipment requires physical on-hand stock for every order line.
    if (status === 'SHIPPED') {
      const plan = await this.allocationService.getPlan();

      const plannedOrder = plan.orders.find(
        (item) => item.orderId === id,
      );

      if (!plannedOrder) {
        throw new ConflictException(
          'Could not find this order in the current allocation plan. Refresh and try again.',
        );
      }

      const deductions = new Map<
        string,
        {
          skuId: string;
          warehouseId: string;
          quantity: number;
        }
      >();

      for (const line of plannedOrder.lines) {
        const onHandAllocated = line.allocations
          .filter((allocation) => allocation.source === 'ON_HAND')
          .reduce(
            (total, allocation) => total + allocation.quantity,
            0,
          );

        if (onHandAllocated < line.requestedQuantity) {
          throw new BadRequestException(
            `Cannot ship order ${order.orderNumber}. SKU ${line.skuCode} requires ${line.requestedQuantity} units, but only ${onHandAllocated} units are available from on-hand inventory. Inbound supply cannot be shipped before receipt.`,
          );
        }

        for (const allocation of line.allocations) {
          if (allocation.source !== 'ON_HAND') {
            continue;
          }

          const key = `${line.skuId}::${allocation.warehouseId}`;
          const existing = deductions.get(key);

          if (existing) {
            existing.quantity += allocation.quantity;
          } else {
            deductions.set(key, {
              skuId: line.skuId,
              warehouseId: allocation.warehouseId,
              quantity: allocation.quantity,
            });
          }
        }
      }

      return this.prisma.$transaction(async (tx) => {
        // Claim the shipment first. This prevents a second request
        // from shipping and deducting the same order again.
        const statusResult = await tx.order.updateMany({
          where: {
            id,
            status: 'FULFILLING',
          },
          data: {
            status: 'SHIPPED',
          },
        });

        if (statusResult.count === 0) {
          throw new ConflictException(
            'Order status changed concurrently. Refresh the order and try again.',
          );
        }

        // Deduct stock atomically and create an audit record.
        for (const deduction of deductions.values()) {
          const inventoryResult = await tx.inventory.updateMany({
            where: {
              skuId: deduction.skuId,
              warehouseId: deduction.warehouseId,
              onHandQuantity: {
                gte: deduction.quantity,
              },
            },
            data: {
              onHandQuantity: {
                decrement: deduction.quantity,
              },
            },
          });

          if (inventoryResult.count === 0) {
            throw new ConflictException(
              'Insufficient on-hand inventory during shipment. No changes were saved.',
            );
          }

          await tx.inventoryAdjustment.create({
            data: {
              skuId: deduction.skuId,
              warehouseId: deduction.warehouseId,
              quantityChange: -deduction.quantity,
              reason: `Order shipment: ${order.orderNumber}`,
            },
          });
        }

        return tx.order.findUnique({
          where: { id },
          include: this.orderInclude,
        });
      });
    }

    // Non-shipment transitions retain the existing behavior.
    const result = await this.prisma.order.updateMany({
      where: {
        id,
        status: order.status,
      },
      data: { status },
    });

    if (result.count === 0) {
      throw new ConflictException(
        'Order status changed concurrently. Fetch the order and try again.',
      );
    }

    return this.findOne(id);
  }
}
