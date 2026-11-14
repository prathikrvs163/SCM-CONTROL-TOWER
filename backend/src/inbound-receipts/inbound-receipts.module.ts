import { Module } from '@nestjs/common';
import { InboundReceiptsController } from './inbound-receipts.controller.js';
import { InboundReceiptsService } from './inbound-receipts.service.js';

@Module({
  controllers: [InboundReceiptsController],
  providers: [InboundReceiptsService]
})
export class InboundReceiptsModule {}
