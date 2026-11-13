
import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateWarehouseDto } from './dto/create-warehouse.dto.js';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto.js';

@Injectable()
export class WarehousesService {
  constructor(private readonly prisma: PrismaService) {}

  // Get all warehouses
  async findAll(includeInactive: boolean = false) {
    return this.prisma.warehouse.findMany({
      where: includeInactive
        ? {}
        : {
            isActive: true,
          },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  // Get a single warehouse by ID
  async findOne(id: string) {
    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id },
    });

    if (!warehouse) {
      throw new NotFoundException(
        `Warehouse with ID ${id} not found`,
      );
    }

    return warehouse;
  }

  // Create a new warehouse
  async create(dto: CreateWarehouseDto) {
    try {
      return await this.prisma.warehouse.create({
        data: {
          code: dto.code,
          name: dto.name,
          city: dto.city,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Warehouse code already exists',
        );
      }

      throw error;
    }
  }

  // Update an existing warehouse
  async update(id: string, dto: UpdateWarehouseDto) {
    const hasUpdate = Object.values(dto).some(
      (value) => value !== undefined,
    );

    if (!hasUpdate) {
      throw new BadRequestException(
        'At least one field must be provided',
      );
    }

    try {
      return await this.prisma.warehouse.update({
        where: { id },
        data: dto,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError
      ) {
        if (error.code === 'P2025') {
          throw new NotFoundException(
            `Warehouse with ID ${id} not found`,
          );
        }

        if (error.code === 'P2002') {
          throw new ConflictException(
            'Warehouse code already exists',
          );
        }
      }

      throw error;
    }
  }

  // Soft delete a warehouse
  async remove(id: string) {
    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id },
    });

    if (!warehouse) {
      throw new NotFoundException(
        `Warehouse with ID ${id} not found`,
      );
    }

    if (!warehouse.isActive) {
      throw new ConflictException(
        `Warehouse with ID ${id} is already inactive`,
      );
    }

    return this.prisma.warehouse.update({
      where: { id },
      data: {
        isActive: false,
      },
    });
  }
}
