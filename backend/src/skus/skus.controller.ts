
import { Body, Controller, Get, Post, Param, Patch } from '@nestjs/common';
import { SkusService } from './skus.service.js';
import { CreateSkuDto } from './dto/create-sku.dto.js';
import { UpdateSkuDto } from './dto/update-sku.dto.js';

@Controller('skus')
export class SkusController {
  constructor(private readonly skusService: SkusService) {}

  @Get()
findAll() {
  return this.skusService.findAll();
}
  @Get(':id')
findOne(@Param('id') id: string) {
  return this.skusService.findOne(id);
}

  @Post()
  create(@Body() dto: CreateSkuDto) {
    return this.skusService.create(dto);
  }

  @Patch(':id')
update(
  @Param('id') id: string,
  @Body() dto: UpdateSkuDto,
) {
  return this.skusService.update(id, dto);
}

}
