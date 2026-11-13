
import { Body, Controller, Get, Post, Param, Patch, Delete, Query } from '@nestjs/common';
import { SkusService } from './skus.service.js';
import { CreateSkuDto } from './dto/create-sku.dto.js';
import { UpdateSkuDto } from './dto/update-sku.dto.js';

@Controller('skus')
export class SkusController {
  constructor(private readonly skusService: SkusService) {}

 @Get()
findAll(
  @Query('includeInactive') includeInactive?: string,
) {
  return this.skusService.findAll(
    includeInactive === 'true',
  );
}

  @Get(':id')
findOne(@Param('id') id: string) {
  return this.skusService.findOne(id);
}

  @Post()
  create(@Body() dto: CreateSkuDto) {
    return this.skusService.create(dto);
  }

  @Delete(':id')
remove(@Param('id') id: string) {
  return this.skusService.remove(id);
}

  @Patch(':id')
update(
  @Param('id') id: string,
  @Body() dto: UpdateSkuDto,
) {
  return this.skusService.update(id, dto);
}

}
