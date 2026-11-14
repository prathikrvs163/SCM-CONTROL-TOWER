import { Module } from '@nestjs/common';
import { ExceptionsController } from './exceptions.controller.js';
import { ExceptionsService } from './exceptions.service.js';
import { AllocationModule } from '../allocation/allocation.module.js';

@Module({
  imports: [AllocationModule],
  controllers: [ExceptionsController],
  providers: [ExceptionsService],
})
export class ExceptionsModule {}
