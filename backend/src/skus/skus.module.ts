import { Module } from '@nestjs/common';
import { SkusController } from './skus.controller.js';
import { SkusService } from './skus.service.js';

@Module({
  controllers: [SkusController],
  providers: [SkusService],
})
export class SkusModule {}
