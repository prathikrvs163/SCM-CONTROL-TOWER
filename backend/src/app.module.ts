import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module.js';
import { AppController } from './app.controller.js';
import { SkusModule } from './skus/skus.module.js';
import { WarehousesModule } from './warehouses/warehouses.module.js';
import { InventoryModule } from './inventory/inventory.module.js';
import { InboundReceiptsModule } from './inbound-receipts/inbound-receipts.module.js';
import { OrdersModule } from './orders/orders.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    SkusModule,
    WarehousesModule,
    InventoryModule,
    InboundReceiptsModule,
    OrdersModule,
  ],
  controllers: [AppController],
})
export class AppModule {}