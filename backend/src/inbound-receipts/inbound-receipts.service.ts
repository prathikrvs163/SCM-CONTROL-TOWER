
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';

import { Prisma, ReceiptStatus } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

import { CreateInboundReceiptDto } from './dto/create-inbound-receipt.dto.js';
import { UpdateInboundReceiptDto } from './dto/update-inbound-receipt.dto.js';
import { UpdateInboundReceiptStatusDto } from './dto/update-inbound-receipt-status.dto.js';

@Injectable()
export class InboundReceiptsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.inboundReceipt.findMany({
      include: { sku: true, warehouse: true },
      orderBy: { expectedArrivalTime: 'asc' },
    });
  }

  async findOne(id: string) {
    const receipt = await this.prisma.inboundReceipt.findUnique({
      where: { id },
      include: { sku: true, warehouse: true },
    });

    if (!receipt) {
      throw new NotFoundException('Inbound receipt not found');
    }

    return receipt;
  }

  async create(dto: CreateInboundReceiptDto) {
    const sku = await this.prisma.sKU.findUnique({
      where: { id: dto.skuId },
    });

    if (!sku || !sku.isActive) {
      throw new NotFoundException('Active SKU not found');
    }

    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id: dto.warehouseId },
    });

    if (!warehouse || !warehouse.isActive) {
      throw new NotFoundException('Active warehouse not found');
    }

    try {
      return await this.prisma.inboundReceipt.create({
        data: {
          receiptId: dto.receiptId.trim(),
          skuId: dto.skuId,
          warehouseId: dto.warehouseId,
          expectedArrivalTime: new Date(dto.expectedArrivalTime),
          quantity: dto.quantity,
        },
        include: { sku: true, warehouse: true },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Receipt ID already exists');
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateInboundReceiptDto) {
    const receipt = await this.findOne(id);

    if (
      receipt.status !== ReceiptStatus.PLANNED &&
      receipt.status !== ReceiptStatus.IN_TRANSIT
    ) {
      throw new BadRequestException(
        'Only planned or in-transit receipts can be edited',
      );
    }

    if (
      dto.expectedArrivalTime === undefined &&
      dto.quantity === undefined
    ) {
      throw new BadRequestException('Provide an ETA or quantity to update');
    }

    const updated = await this.prisma.inboundReceipt.updateMany({
      where: {
        id,
        status: { in: [ReceiptStatus.PLANNED, ReceiptStatus.IN_TRANSIT] },
      },
      data: {
        ...(dto.expectedArrivalTime !== undefined
          ? { expectedArrivalTime: new Date(dto.expectedArrivalTime) }
          : {}),
        ...(dto.quantity !== undefined ? { quantity: dto.quantity } : {}),
      },
    });

    if (updated.count !== 1) {
      throw new ConflictException('Receipt status changed; reload and retry');
    }

    return this.findOne(id);
  }

  async updateStatus(
    id: string,
    dto: UpdateInboundReceiptStatusDto,
  ) {
    const receipt = await this.findOne(id);

    if (
      receipt.status !== ReceiptStatus.PLANNED &&
      receipt.status !== ReceiptStatus.IN_TRANSIT
    ) {
      throw new BadRequestException(
        'Received or canceled receipts cannot change status',
      );
    }

    if (
      dto.status === 'IN_TRANSIT' &&
      receipt.status !== ReceiptStatus.PLANNED
    ) {
      throw new BadRequestException(
        'Only planned receipts can move to in-transit',
      );
    }

    const updated = await this.prisma.inboundReceipt.updateMany({
      where: {
        id,
        status: receipt.status,
      },
      data: { status: dto.status },
    });

    if (updated.count !== 1) {
      throw new ConflictException('Receipt status changed; reload and retry');
    }

    return this.findOne(id);
  }

  async receive(id: string) {
    return this.prisma.$transaction(async (tx) => {
      const receipt = await tx.inboundReceipt.findUnique({
        where: { id },
      });

      if (!receipt) {
        throw new NotFoundException('Inbound receipt not found');
      }

      // Repeated requests must never add the same stock again.
      if (receipt.status === ReceiptStatus.RECEIVED) {
        return tx.inboundReceipt.findUnique({
          where: { id },
          include: { sku: true, warehouse: true },
        });
      }

      if (receipt.status === ReceiptStatus.CANCELED) {
        throw new BadRequestException(
          'Canceled receipts cannot be received',
        );
      }

      // Claim the receipt before changing inventory.
      const claimed = await tx.inboundReceipt.updateMany({
        where: {
          id,
          status: {
            in: [ReceiptStatus.PLANNED, ReceiptStatus.IN_TRANSIT],
          },
        },
        data: {
          status: ReceiptStatus.RECEIVED,
          receivedAt: new Date(),
        },
      });

      if (claimed.count !== 1) {
        throw new ConflictException(
          'Receipt is being processed; reload and retry',
        );
      }

      // Add the received quantity to inventory.
      await tx.inventory.upsert({
        where: {
          skuId_warehouseId: {
            skuId: receipt.skuId,
            warehouseId: receipt.warehouseId,
          },
        },
        create: {
          skuId: receipt.skuId,
          warehouseId: receipt.warehouseId,
          onHandQuantity: receipt.quantity,
        },
        update: {
          onHandQuantity: { increment: receipt.quantity },
        },
      });

      // Record the stock movement in adjustment history.
      await tx.inventoryAdjustment.create({
        data: {
          skuId: receipt.skuId,
          warehouseId: receipt.warehouseId,
          quantityChange: receipt.quantity,
          reason: `Inbound receipt received: ${receipt.receiptId}`,
        },
      });

      return tx.inboundReceipt.findUnique({
        where: { id },
        include: { sku: true, warehouse: true },
      });
    });
  }
}
