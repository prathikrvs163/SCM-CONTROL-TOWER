
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';

import { InboundReceiptsService } from './inbound-receipts.service.js';
import { CreateInboundReceiptDto } from './dto/create-inbound-receipt.dto.js';
import { UpdateInboundReceiptDto } from './dto/update-inbound-receipt.dto.js';
import { UpdateInboundReceiptStatusDto } from './dto/update-inbound-receipt-status.dto.js';

@Controller('inbound-receipts')
export class InboundReceiptsController {
  constructor(
    private readonly inboundReceiptsService: InboundReceiptsService,
  ) {}

  @Get()
  findAll() {
    return this.inboundReceiptsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.inboundReceiptsService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateInboundReceiptDto) {
    return this.inboundReceiptsService.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateInboundReceiptDto,
  ) {
    return this.inboundReceiptsService.update(id, dto);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateInboundReceiptStatusDto,
  ) {
    return this.inboundReceiptsService.updateStatus(id, dto);
  }

  @Post(':id/receive')
  receive(@Param('id') id: string) {
    return this.inboundReceiptsService.receive(id);
  }
}
