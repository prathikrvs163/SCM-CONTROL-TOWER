import {
  Controller,
  Get,
  Post,
  Body,
  Query,
} from '@nestjs/common';

import { InventoryService } from './inventory.service.js';
import { CreateInventoryAdjustmentDto } from './dto/create-inventory-adjustment.dto.js';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  findAll() {
    return this.inventoryService.findAll();
  }

  @Post('adjustments')
  createAdjustment(@Body() dto: CreateInventoryAdjustmentDto) {
    return this.inventoryService.createAdjustment(dto);
  }

  @Get('adjustments')
  findAdjustments(
    @Query('skuId') skuId?: string,
    @Query('warehouseId') warehouseId?: string,
  ) {
    return this.inventoryService.findAdjustments(skuId, warehouseId);
  }
}