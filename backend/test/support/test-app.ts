import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';

import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';

export interface TestContext {
  app: INestApplication<App>;
  prisma: PrismaService;
  http: () => ReturnType<typeof request>;
}

export async function createTestApp(): Promise<TestContext> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = configureApp(
    moduleRef.createNestApplication<INestApplication<App>>({ logger: false }),
  );
  await app.init();

  return {
    app,
    prisma: app.get(PrismaService),
    http: () => request(app.getHttpServer()),
  };
}

const TABLES = [
  'AuditLog',
  'OrderStatusHistory',
  'OrderLine',
  'Order',
  'InboundReceipt',
  'InventoryAdjustment',
  'Inventory',
  'Warehouse',
  'SKU',
];

/**
 * Empty every table, children first. DELETE is much faster than TRUNCATE
 * on small InnoDB tables, and running it in one transaction keeps a failed
 * reset from leaving half the data behind.
 */
export async function resetDatabase(prisma: PrismaService) {
  await prisma.$transaction(async (tx) => {
    for (const table of TABLES) {
      await tx.$executeRawUnsafe(`DELETE FROM \`${table}\``);
    }
  });
}

export const DAY_MS = 24 * 60 * 60 * 1000;

/** Today at 00:00 UTC, the allocation engine's planning date. */
export function planningDate(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

export function daysFromToday(days: number): Date {
  return new Date(planningDate().getTime() + days * DAY_MS);
}

/**
 * Minimal master data: two warehouses (BLR, HYD) and one SKU. Returns the
 * created rows so tests can reference IDs.
 */
export async function seedMasterData(prisma: PrismaService) {
  const blr = await prisma.warehouse.create({
    data: { code: 'BLR', name: 'Bengaluru DC', city: 'Bengaluru' },
  });
  const hyd = await prisma.warehouse.create({
    data: { code: 'HYD', name: 'Hyderabad DC', city: 'Hyderabad' },
  });
  const sku = await prisma.sKU.create({
    data: { skuCode: 'TEST-SKU-1', name: 'Test widget' },
  });

  return { blr, hyd, sku };
}

export async function setOnHand(
  prisma: PrismaService,
  skuId: string,
  warehouseId: string,
  onHandQuantity: number,
  safetyStock = 0,
) {
  await prisma.inventory.upsert({
    where: { skuId_warehouseId: { skuId, warehouseId } },
    create: { skuId, warehouseId, onHandQuantity, safetyStock },
    update: { onHandQuantity, safetyStock },
  });
}

/** Create an order through the API and move it to the given status. */
export async function createOrder(
  ctx: TestContext,
  body: {
    orderNumber: string;
    customerName?: string;
    priority?: 'LOW' | 'MED' | 'HIGH';
    requestedShipDate?: string;
    lines: { skuId: string; quantity: number; preferredWarehouseId?: string }[];
  },
  status: 'DRAFT' | 'CONFIRMED' | 'FULFILLING' = 'CONFIRMED',
) {
  const created = await ctx
    .http()
    .post('/orders')
    .send({ customerName: 'Test Customer', ...body })
    .expect(201);

  const path = ['CONFIRMED', 'FULFILLING'].slice(
    0,
    status === 'DRAFT' ? 0 : status === 'CONFIRMED' ? 1 : 2,
  );

  for (const next of path) {
    await ctx
      .http()
      .patch(`/orders/${created.body.id}/status`)
      .send({ status: next })
      .expect(200);
  }

  return created.body as {
    id: string;
    orderNumber: string;
    lines: { id: string; skuId: string; quantity: number }[];
  };
}

export async function createReceipt(
  ctx: TestContext,
  body: {
    receiptId: string;
    skuId: string;
    warehouseId: string;
    quantity: number;
    expectedArrivalTime: Date;
  },
) {
  const response = await ctx
    .http()
    .post('/inbound-receipts')
    .send({
      ...body,
      expectedArrivalTime: body.expectedArrivalTime.toISOString(),
    })
    .expect(201);

  return response.body as { id: string; receiptId: string };
}

export async function planLine(ctx: TestContext, orderId: string) {
  const plan = await ctx.http().get('/allocation/plan').expect(200);
  const order = (
    plan.body.orders as {
      orderId: string;
      lines: {
        orderLineId: string;
        allocatedQuantity: number;
        backorderedQuantity: number;
        promisedShipDate: string | null;
        computedPromisedShipDate: string | null;
        promiseOverridden: boolean;
        isLate: boolean;
        promiseReason: string;
        allocations: {
          warehouseCode: string;
          source: string;
          quantity: number;
          receiptId: string | null;
        }[];
      }[];
    }[]
  ).find((item) => item.orderId === orderId);

  return order?.lines[0];
}

export async function exceptionTypes(ctx: TestContext, orderId: string) {
  const response = await ctx.http().get('/exceptions').expect(200);
  return (response.body.exceptions as { orderId: string; type: string; severity: string }[])
    .filter((item) => item.orderId === orderId)
    .map((item) => `${item.type}:${item.severity}`)
    .sort();
}

export async function auditActions(
  ctx: TestContext,
  entityType: string,
  entityId: string,
) {
  const response = await ctx
    .http()
    .get('/audit-logs')
    .query({ entityType, entityId })
    .expect(200);

  return (response.body as { action: string; reason: string | null }[])
    .map((entry) => entry.action)
    .reverse();
}
