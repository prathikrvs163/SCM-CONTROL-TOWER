import {
  createOrder,
  createReceipt,
  createTestApp,
  daysFromToday,
  exceptionTypes,
  resetDatabase,
  seedMasterData,
} from './support/test-app.js';
import type { TestContext } from './support/test-app.js';

/**
 * The exceptions queue is derived from the allocation plan on every request.
 * These tests walk one order through supply changes and check that the
 * queue raises and clears exceptions as the plan changes.
 */
describe('Exceptions lifecycle (real database)', () => {
  let ctx: TestContext;
  let master: Awaited<ReturnType<typeof seedMasterData>>;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
    master = await seedMasterData(ctx.prisma);
  });

  it('raises and clears exceptions as supply arrives', async () => {
    const order = await createOrder(ctx, {
      orderNumber: 'SO-1',
      priority: 'HIGH',
      requestedShipDate: daysFromToday(3).toISOString(),
      lines: [{ skuId: master.sku.id, quantity: 10 }],
    });

    // 1. No supply at all.
    expect(await exceptionTypes(ctx, order.id)).toEqual(['BACKORDER:HIGH']);

    // 2. A receipt covers it, but arrives after the requested date.
    const receipt = await createReceipt(ctx, {
      receiptId: 'RCV-1',
      skuId: master.sku.id,
      warehouseId: master.blr.id,
      quantity: 10,
      expectedArrivalTime: daysFromToday(7),
    });
    expect(await exceptionTypes(ctx, order.id)).toEqual([
      'INBOUND_DEPENDENCY:LOW',
      'LATE_PROMISE:HIGH',
    ]);

    // 3. Expediting removes the lateness but not the inbound dependency.
    await ctx
      .http()
      .post(`/planner-actions/receipts/${receipt.id}/expedite`)
      .send({
        expectedArrivalTime: daysFromToday(2).toISOString(),
        reason: 'Air freight',
      })
      .expect(201);
    expect(await exceptionTypes(ctx, order.id)).toEqual(['INBOUND_DEPENDENCY:LOW']);

    // 4. Receiving the stock clears the queue for this order.
    await ctx.http().post(`/inbound-receipts/${receipt.id}/receive`).expect(201);
    expect(await exceptionTypes(ctx, order.id)).toEqual([]);
  });

  it('brings a backorder back when the receipt it relied on is canceled', async () => {
    const order = await createOrder(ctx, {
      orderNumber: 'SO-1',
      lines: [{ skuId: master.sku.id, quantity: 5 }],
    });
    const receipt = await createReceipt(ctx, {
      receiptId: 'RCV-1',
      skuId: master.sku.id,
      warehouseId: master.blr.id,
      quantity: 5,
      expectedArrivalTime: daysFromToday(4),
    });

    expect(await exceptionTypes(ctx, order.id)).toEqual(['INBOUND_DEPENDENCY:LOW']);

    await ctx
      .http()
      .patch(`/inbound-receipts/${receipt.id}/status`)
      .send({ status: 'CANCELED' })
      .expect(200);

    expect(await exceptionTypes(ctx, order.id)).toEqual(['BACKORDER:MEDIUM']);
  });

  it('drops exceptions for canceled orders and filters by severity', async () => {
    const high = await createOrder(ctx, {
      orderNumber: 'SO-HIGH',
      priority: 'HIGH',
      lines: [{ skuId: master.sku.id, quantity: 2 }],
    });
    const low = await createOrder(ctx, {
      orderNumber: 'SO-LOW',
      priority: 'LOW',
      lines: [{ skuId: master.sku.id, quantity: 2 }],
    });

    const highOnly = await ctx.http().get('/exceptions').query({ severity: 'HIGH' }).expect(200);
    expect(highOnly.body).toMatchObject({ totalExceptions: 1, highCount: 1 });
    expect(highOnly.body.exceptions[0].orderId).toBe(high.id);

    await ctx
      .http()
      .patch(`/orders/${low.id}/status`)
      .send({ status: 'CANCELED' })
      .expect(200);

    const all = await ctx.http().get('/exceptions').expect(200);
    expect(all.body.exceptions.map((item: { orderId: string }) => item.orderId)).toEqual([
      high.id,
    ]);
  });

  it('ignores draft orders until they are confirmed', async () => {
    const order = await createOrder(
      ctx,
      { orderNumber: 'SO-1', lines: [{ skuId: master.sku.id, quantity: 3 }] },
      'DRAFT',
    );

    expect(await exceptionTypes(ctx, order.id)).toEqual([]);

    await ctx
      .http()
      .patch(`/orders/${order.id}/status`)
      .send({ status: 'CONFIRMED' })
      .expect(200);

    expect(await exceptionTypes(ctx, order.id)).toEqual(['BACKORDER:MEDIUM']);
  });
});
