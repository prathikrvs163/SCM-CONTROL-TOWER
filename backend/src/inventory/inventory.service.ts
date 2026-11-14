import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { CreateInventoryAdjustmentDto } from './dto/create-inventory-adjustment.dto.js';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  // List inventory balances
  async findAll() {
    return this.prisma.inventory.findMany({
      include: {
        sku: true,
        warehouse: true,
      },
      orderBy: [
        { warehouseId: 'asc' },
        { skuId: 'asc' },
      ],
    });
  }

  // Create a stock adjustment and audit record atomically
  async createAdjustment(dto: CreateInventoryAdjustmentDto) {
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

    const reason = dto.reason.trim();

    if (reason.length < 3) {
      throw new BadRequestException(
        'Adjustment reason must be at least 3 characters',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // Create a zero-balance row if this SKU/warehouse has no inventory yet.
      await tx.inventory.upsert({
        where: {
          skuId_warehouseId: {
            skuId: dto.skuId,
            warehouseId: dto.warehouseId,
          },
        },
        create: {
          skuId: dto.skuId,
          warehouseId: dto.warehouseId,
          onHandQuantity: 0,
        },
        update: {},
      });

      // Apply the adjustment atomically.
      // For deductions, only update if sufficient stock exists.
      const updated = await tx.inventory.updateMany({
        where: {
          skuId: dto.skuId,
          warehouseId: dto.warehouseId,
          ...(dto.quantityChange < 0
            ? { onHandQuantity: { gte: Math.abs(dto.quantityChange) } }
            : {}),
        },
        data: {
          onHandQuantity: {
            increment: dto.quantityChange,
          },
        },
      });

      if (updated.count !== 1) {
        throw new BadRequestException(
          'Insufficient stock for this adjustment',
        );
      }

      // Record the reason and quantity change in the same transaction.
      await tx.inventoryAdjustment.create({
        data: {
          skuId: dto.skuId,
          warehouseId: dto.warehouseId,
          quantityChange: dto.quantityChange,
          reason,
        },
      });

      return tx.inventory.findUnique({
        where: {
          skuId_warehouseId: {
            skuId: dto.skuId,
            warehouseId: dto.warehouseId,
          },
        },
        include: {
          sku: true,
          warehouse: true,
        },
      });
    });
  }

  // View adjustment history, optionally filtered by SKU or warehouse
  async findAdjustments(skuId?: string, warehouseId?: string) {
    return this.prisma.inventoryAdjustment.findMany({
      where: {
        ...(skuId ? { skuId } : {}),
        ...(warehouseId ? { warehouseId } : {}),
      },
      include: {
        sku: true,
        warehouse: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}