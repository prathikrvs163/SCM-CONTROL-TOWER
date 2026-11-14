import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';
import { AllocationModule } from '../allocation/allocation.module.js';

@Module({
  imports: [AllocationModule],
  controllers: [OrdersController],
  providers: [OrdersService]
})
export class OrdersModule {}
