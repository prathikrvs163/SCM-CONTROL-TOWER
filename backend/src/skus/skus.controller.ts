
import { Body, Controller, Post } from '@nestjs/common';
import { SkusService } from './skus.service.js';
import { CreateSkuDto } from './dto/create-sku.dto.js';

@Controller('skus')
export class SkusController {
  constructor(private readonly skusService: SkusService) {}

  @Post()
  create(@Body() dto: CreateSkuDto) {
    return this.skusService.create(dto);
  }
}
