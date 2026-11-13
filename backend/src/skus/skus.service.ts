
import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateSkuDto } from './dto/create-sku.dto.js';




@Injectable()
export class SkusService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
  return this.prisma.sKU.findMany({
    orderBy: {
      createdAt: 'desc',
    },
  });
}

async findOne(id: string) {
  const sku = await this.prisma.sKU.findUnique({
    where: {
      id: id,
    },
  });

  if (!sku) {
    throw new NotFoundException(`SKU with ID ${id} not found`);
  }

  return sku;
}

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
        throw new ConflictException('SKU code already exists');
      }

      throw error;
    }
  }
}
