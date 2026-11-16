import {
  auditActions,
  createOrder,
  createReceipt,
  createTestApp,
  daysFromToday,
  planLine,
  resetDatabase,
  seedMasterData,
  setOnHand,
} from './support/test-app.js';
import type { TestContext } from './support/test-app.js';

describe('Planner actions API (real database)', () => {
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

  describe('expedite receipt', () => {
    it('moves the ETA earlier, improves the promise and audits the reason', async () => {
      const receipt = await createReceipt(ctx, {
        receiptId: 'RCV-1',
        skuId: master.sku.id,
        warehouseId: master.blr.id,
        quantity: 10,
        expectedArrivalTime: daysFromToday(10),
      });
      const order = await createOrder(ctx, {
        orderNumber: 'SO-1',
        requestedShipDate: daysFromToday(5).toISOString(),
        lines: [{ skuId: master.sku.id, quantity: 10 }],
      });

      expect((await planLine(ctx, order.id))?.isLate).toBe(true);

      const expedited = await ctx
        .http()
        .post(`/planner-actions/receipts/${receipt.id}/expedite`)
        .send({
          expectedArrivalTime: daysFromToday(3).toISOString(),
          reason: 'Supplier agreed to air freight',
        })
        .expect(201);

      expect(new Date(expedited.body.expectedArrivalTime)).toEqual(daysFromToday(3));

      const line = await planLine(ctx, order.id);
      expect(new Date(line!.promisedShipDate!)).toEqual(daysFromToday(3));
      expect(line?.isLate).toBe(false);

      const [entry] = await ctx.prisma.auditLog.findMany({
        where: { action: 'RECEIPT_EXPEDITED' },
      });
      expect(entry).toMatchObject({
        entityId: receipt.id,
        entityRef: 'RCV-1',
        reason: 'Supplier agreed to air freight',
      });
    });

    it('rejects a later ETA, a missing reason and an unknown receipt', async () => {
      const receipt = await createReceipt(ctx, {
        receiptId: 'RCV-1',
        skuId: master.sku.id,
        warehouseId: master.blr.id,
        quantity: 10,
        expectedArrivalTime: daysFromToday(5),
      });

      await ctx
        .http()
        .post(`/planner-actions/receipts/${receipt.id}/expedite`)
        .send({ expectedArrivalTime: daysFromToday(8).toISOString(), reason: 'Later' })
        .expect(400);
      await ctx
        .http()
        .post(`/planner-actions/receipts/${receipt.id}/expedite`)
        .send({ expectedArrivalTime: daysFromToday(2).toISOString() })
        .expect(400);
      await ctx
        .http()
        .post(`/planner-actions/receipts/${receipt.id}/expedite`)
        .send({ expectedArrivalTime: daysFromToday(2).toISOString(), reason: '  ' })
        .expect(400);
      await ctx
        .http()
        .post('/planner-actions/receipts/missing/expedite')
        .send({ expectedArrivalTime: daysFromToday(2).toISOString(), reason: 'Faster' })
        .expect(404);

      expect(await ctx.prisma.auditLog.count({ where: { action: 'RECEIPT_EXPEDITED' } })).toBe(0);
    });
  });

  it('reassigns a line so the plan draws from the new warehouse first', async () => {
    await setOnHand(ctx.prisma, master.sku.id, master.blr.id, 10);
    await setOnHand(ctx.prisma, master.sku.id, master.hyd.id, 10);
    const order = await createOrder(ctx, {
      orderNumber: 'SO-1',
      lines: [{ skuId: master.sku.id, quantity: 4 }],
    });

    expect((await planLine(ctx, order.id))?.allocations[0].warehouseCode).toBe('BLR');

    const updated = await ctx
      .http()
      .post(`/planner-actions/order-lines/${order.lines[0].id}/reassign`)
      .send({ warehouseId: master.hyd.id, reason: 'BLR dock closed' })
      .expect(201);

    expect(updated.body.lines[0].preferredWarehouseId).toBe(master.hyd.id);
    expect((await planLine(ctx, order.id))?.allocations).toEqual([
      expect.objectContaining({ warehouseCode: 'HYD', quantity: 4 }),
    ]);
    expect(await auditActions(ctx, 'ORDER', order.id)).toContain(
      'LINE_FULFILLMENT_REASSIGNED',
    );
  });

  it('overrides and clears a promise date', async () => {
    await setOnHand(ctx.prisma, master.sku.id, master.blr.id, 10);
    const order = await createOrder(ctx, {
      orderNumber: 'SO-1',
      requestedShipDate: daysFromToday(2).toISOString(),
      lines: [{ skuId: master.sku.id, quantity: 4 }],
    });
    const lineId = order.lines[0].id;

    await ctx
      .http()
      .post(`/planner-actions/order-lines/${lineId}/promise-override`)
      .send({
        promisedShipDate: daysFromToday(6).toISOString(),
        reason: 'Customer asked to consolidate',
      })
      .expect(201);

    let line = await planLine(ctx, order.id);
    expect(line?.promiseOverridden).toBe(true);
    expect(new Date(line!.promisedShipDate!)).toEqual(daysFromToday(6));
    expect(new Date(line!.computedPromisedShipDate!)).toEqual(daysFromToday(0));
    expect(line?.isLate).toBe(true);
    expect(line?.promiseReason).toBe(
      'Planner override: Customer asked to consolidate',
    );

    await ctx
      .http()
      .post(`/planner-actions/order-lines/${lineId}/promise-override`)
      .send({ promisedShipDate: null, reason: 'Customer withdrew request' })
      .expect(201);

    line = await planLine(ctx, order.id);
    expect(line?.promiseOverridden).toBe(false);
    expect(new Date(line!.promisedShipDate!)).toEqual(daysFromToday(0));

    const actions = await auditActions(ctx, 'ORDER', order.id);
    expect(actions.slice(-2)).toEqual([
      'PROMISE_DATE_OVERRIDDEN',
      'PROMISE_OVERRIDE_CLEARED',
    ]);
  });

  it('splits a shipment so the covered part can ship', async () => {
    await setOnHand(ctx.prisma, master.sku.id, master.blr.id, 6);
    const order = await createOrder(
      ctx,
      {
        orderNumber: 'SO-1',
        priority: 'HIGH',
        lines: [{ skuId: master.sku.id, quantity: 10 }],
      },
      'FULFILLING',
    );

    // 6 on hand cannot cover 10.
    await ctx
      .http()
      .patch(`/orders/${order.id}/status`)
      .send({ status: 'SHIPPED' })
      .expect(400);

    const split = await ctx
      .http()
      .post(`/planner-actions/orders/${order.id}/split`)
      .send({
        lines: [{ orderLineId: order.lines[0].id, quantity: 4 }],
        reason: 'Ship available units now',
      })
      .expect(201);

    expect(split.body.originalOrder.lines[0].quantity).toBe(6);
    expect(split.body.splitOrder).toMatchObject({
      orderNumber: 'SO-1-S1',
      status: 'FULFILLING',
      priority: 'HIGH',
      splitFromOrderId: order.id,
      lines: [expect.objectContaining({ quantity: 4 })],
    });

    const [original, child] = await Promise.all([
      ctx.prisma.order.findUniqueOrThrow({ where: { id: order.id } }),
      ctx.prisma.order.findUniqueOrThrow({ where: { id: split.body.splitOrder.id } }),
    ]);
    expect(child.createdAt).toEqual(original.createdAt);

    await ctx
      .http()
      .patch(`/orders/${order.id}/status`)
      .send({ status: 'SHIPPED' })
      .expect(200);

    expect((await planLine(ctx, split.body.splitOrder.id))?.backorderedQuantity).toBe(4);
    expect(await auditActions(ctx, 'ORDER', order.id)).toContain('ORDER_SPLIT');
    expect(await auditActions(ctx, 'ORDER', split.body.splitOrder.id)).toEqual([
      'ORDER_CREATED_FROM_SPLIT',
    ]);

    const second = await ctx
      .http()
      .post(`/planner-actions/orders/${split.body.splitOrder.id}/split`)
      .send({
        lines: [{ orderLineId: split.body.splitOrder.lines[0].id, quantity: 4 }],
        reason: 'Move everything',
      });
    expect(second.status).toBe(400);
  });

  it('blocks planner actions on shipped and canceled orders', async () => {
    const order = await createOrder(ctx, {
      orderNumber: 'SO-1',
      lines: [{ skuId: master.sku.id, quantity: 2 }],
    });
    await ctx
      .http()
      .patch(`/orders/${order.id}/status`)
      .send({ status: 'CANCELED' })
      .expect(200);

    const lineId = order.lines[0].id;

    await ctx
      .http()
      .post(`/planner-actions/order-lines/${lineId}/reassign`)
      .send({ warehouseId: master.hyd.id, reason: 'Too late' })
      .expect(400);
    await ctx
      .http()
      .post(`/planner-actions/order-lines/${lineId}/promise-override`)
      .send({ promisedShipDate: daysFromToday(3).toISOString(), reason: 'Too late' })
      .expect(400);
    await ctx
      .http()
      .post(`/planner-actions/orders/${order.id}/split`)
      .send({ lines: [{ orderLineId: lineId, quantity: 1 }], reason: 'Too late' })
      .expect(400);
  });
});
