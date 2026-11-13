
import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateSkuDto } from './dto/create-sku.dto.js';
import { UpdateSkuDto } from './dto/update-sku.dto.js';

@Injectable()
export class SkusService {
  constructor(private readonly prisma: PrismaService) {}

  // Get all SKUs
async findAll(includeInactive: boolean = false) {
  return this.prisma.sKU.findMany({
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


  // Get a single SKU by ID
  async findOne(id: string) {
    const sku = await this.prisma.sKU.findUnique({
      where: {
        id: id,
      },
    });

    if (!sku) {
      throw new NotFoundException(
        `SKU with ID ${id} not found`,
      );
    }

    return sku;
  }

  // Create a new SKU
  async create(dto: CreateSkuDto) {
    try {
      return await this.prisma.sKU.create({
        data: {
          skuCode: dto.skuCode,
          name: dto.name,
          description: dto.description,
          unit: dto.unit ?? 'EA',
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'SKU code already exists',
        );
      }

      throw error;
    }
  }


  // Soft delete an SKU
  
async remove(id: string) {
  const sku = await this.prisma.sKU.findUnique({
    where: { id },
  });

  if (!sku) {
    throw new NotFoundException(
      `SKU with ID ${id} not found`,
    );
  }

  if (!sku.isActive) {
    throw new ConflictException(
      `SKU with ID ${id} is already inactive`,
    );
  }

  return this.prisma.sKU.update({
    where: { id },
    data: {
      isActive: false,
    },
  });
}



  // Update an existing SKU
  async update(id: string, dto: UpdateSkuDto) {
    const hasUpdate = Object.values(dto).some(
      (value) => value !== undefined,
    );

    if (!hasUpdate) {
      throw new BadRequestException(
        'At least one field must be provided',
      );
    }

    try {
      return await this.prisma.sKU.update({
        where: { id },
        data: dto,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError
      ) {
        if (error.code === 'P2025') {
          throw new NotFoundException(
            `SKU with ID ${id} not found`,
          );
        }

        if (error.code === 'P2002') {
          throw new ConflictException(
            'SKU code already exists',
          );
        }
      }

      throw error;
    }
  }
}
