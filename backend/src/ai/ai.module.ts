import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiController } from './ai.controller.js';
import { AiService } from './ai.service.js';
import { ExceptionsModule } from '../exceptions/exceptions.module.js';
import { OrdersModule } from '../orders/orders.module.js';
import { AllocationModule } from '../allocation/allocation.module.js';

@Module({
  imports: [
    ConfigModule,
    ExceptionsModule,
    OrdersModule,
    AllocationModule,
  ],
  controllers: [AiController],
  providers: [AiService],
})
export class AiModule {}