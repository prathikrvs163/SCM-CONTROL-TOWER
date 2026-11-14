import { Module } from '@nestjs/common';
import { AllocationService } from './allocation.service.js';
import { AllocationController } from './allocation.controller.js';

@Module({
  providers: [AllocationService],
  controllers: [AllocationController],
  exports: [AllocationService],
})
export class AllocationModule {}
