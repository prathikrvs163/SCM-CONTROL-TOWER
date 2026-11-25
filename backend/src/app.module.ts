import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module.js';
import { AppController } from './app.controller.js';
import { SkusModule } from './skus/skus.module.js';
import { WarehousesModule } from './warehouses/warehouses.module.js';
import { InventoryModule } from './inventory/inventory.module.js';
import { InboundReceiptsModule } from './inbound-receipts/inbound-receipts.module.js';
import { OrdersModule } from './orders/orders.module.js';
import { AllocationModule } from './allocation/allocation.module.js';
import { ExceptionsModule } from './exceptions/exceptions.module.js';
import { AiModule } from './ai/ai.module.js';
import { AuditModule } from './audit/audit.module.js';
import { PlannerActionsModule } from './planner-actions/planner-actions.module.js';
import { HealthModule } from './health/health.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuditModule,
    SkusModule,
    WarehousesModule,
    InventoryModule,
    InboundReceiptsModule,
    OrdersModule,
    AllocationModule,
    ExceptionsModule,
    AiModule,
    PlannerActionsModule,
    HealthModule,
  ],
  controllers: [AppController],
})
export class AppModule {}