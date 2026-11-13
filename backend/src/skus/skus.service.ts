
import {
  Injectable,
  ConflictException,
} from '@nestjs/common';

import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateSkuDto } from './dto/create-sku.dto.js';

@Injectable()
export class SkusService {
  constructor(private readonly prisma: PrismaService) {}

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
