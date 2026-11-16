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

describe('Orders API (real database)', () => {
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

  async function onHand() {
    const row = await ctx.prisma.inventory.findUnique({
      where: {
        skuId_warehouseId: { skuId: master.sku.id, warehouseId: master.blr.id },
      },
    });
    return row?.onHandQuantity ?? 0;
  }

  it('creates a draft order with history and an audit entry', async () => {
    const order = await createOrder(
      ctx,
      { orderNumber: 'SO-1', lines: [{ skuId: master.sku.id, quantity: 3 }] },
      'DRAFT',
    );

    const timeline = await ctx.http().get(`/orders/${order.id}/timeline`).expect(200);
    expect(timeline.body.status).toBe('DRAFT');
    expect(timeline.body.statusHistory).toEqual([
      expect.objectContaining({ fromStatus: null, toStatus: 'DRAFT' }),
    ]);
    expect(await auditActions(ctx, 'ORDER', order.id)).toEqual(['ORDER_CREATED']);
  });

  it('edits a draft order, replacing its lines, and audits the change', async () => {
    const order = await createOrder(
      ctx,
      { orderNumber: 'SO-1', lines: [{ skuId: master.sku.id, quantity: 3 }] },
      'DRAFT',
    );

    const updated = await ctx
      .http()
      .patch(`/orders/${order.id}`)
      .send({
        priority: 'HIGH',
        lines: [
          { skuId: master.sku.id, quantity: 4, preferredWarehouseId: master.hyd.id },
        ],
      })
      .expect(200);

    expect(updated.body.priority).toBe('HIGH');
    expect(updated.body.lines).toEqual([
      expect.objectContaining({ quantity: 4, preferredWarehouseId: master.hyd.id }),
    ]);

    const [entry] = await ctx.prisma.auditLog.findMany({
      where: { action: 'ORDER_UPDATED' },
    });
    expect(entry.before).toMatchObject({ priority: 'MED', lines: [{ quantity: 3 }] });
    expect(entry.after).toMatchObject({ priority: 'HIGH', lines: [{ quantity: 4 }] });
  });

  it('rejects edits once an order is confirmed', async () => {
    const order = await createOrder(ctx, {
      orderNumber: 'SO-1',
      lines: [{ skuId: master.sku.id, quantity: 3 }],
    });

    await ctx
      .http()
      .patch(`/orders/${order.id}`)
      .send({ customerName: 'Changed' })
      .expect(400);
  });

  it('enforces the status state machine and records every transition', async () => {
    const order = await createOrder(
      ctx,
      { orderNumber: 'SO-1', lines: [{ skuId: master.sku.id, quantity: 1 }] },
      'DRAFT',
    );

    await ctx
      .http()
      .patch(`/orders/${order.id}/status`)
      .send({ status: 'SHIPPED' })
      .expect(400);
    await ctx
      .http()
      .patch(`/orders/${order.id}/status`)
      .send({ status: 'CONFIRMED' })
      .expect(200);
    await ctx
      .http()
      .patch(`/orders/${order.id}/status`)
      .send({ status: 'CANCELED' })
      .expect(200);
    await ctx
      .http()
      .patch(`/orders/${order.id}/status`)
      .send({ status: 'CONFIRMED' })
      .expect(400);

    const timeline = await ctx.http().get(`/orders/${order.id}/timeline`).expect(200);
    expect(
      timeline.body.statusHistory.map(
        (event: { fromStatus: string | null; toStatus: string }) =>
          `${event.fromStatus ?? '∅'}→${event.toStatus}`,
      ),
    ).toEqual(['∅→DRAFT', 'DRAFT→CONFIRMED', 'CONFIRMED→CANCELED']);
  });

  it('ships an order covered by on-hand and deducts the stock', async () => {
    await setOnHand(ctx.prisma, master.sku.id, master.blr.id, 10);
    const order = await createOrder(
      ctx,
      { orderNumber: 'SO-1', lines: [{ skuId: master.sku.id, quantity: 4 }] },
      'FULFILLING',
    );

    const shipped = await ctx
      .http()
      .patch(`/orders/${order.id}/status`)
      .send({ status: 'SHIPPED' })
      .expect(200);

    expect(shipped.body.status).toBe('SHIPPED');
    expect(await onHand()).toBe(6);
    expect(await ctx.prisma.inventoryAdjustment.findMany()).toEqual([
      expect.objectContaining({ quantityChange: -4, reason: 'Order shipment: SO-1' }),
    ]);
    expect(await auditActions(ctx, 'ORDER', order.id)).toEqual([
      'ORDER_CREATED',
      'ORDER_STATUS_CHANGED',
      'ORDER_STATUS_CHANGED',
      'ORDER_SHIPPED',
    ]);
  });

  it('refuses to ship stock that is only inbound', async () => {
    await setOnHand(ctx.prisma, master.sku.id, master.blr.id, 2);
    await createReceipt(ctx, {
      receiptId: 'RCV-1',
      skuId: master.sku.id,
      warehouseId: master.blr.id,
      quantity: 10,
      expectedArrivalTime: daysFromToday(3),
    });
    const order = await createOrder(
      ctx,
      { orderNumber: 'SO-1', lines: [{ skuId: master.sku.id, quantity: 5 }] },
      'FULFILLING',
    );

    await ctx
      .http()
      .patch(`/orders/${order.id}/status`)
      .send({ status: 'SHIPPED' })
      .expect(400);

    expect(await onHand()).toBe(2);
  });

  it('deducts stock once under concurrent ship calls', async () => {
    await setOnHand(ctx.prisma, master.sku.id, master.blr.id, 10);
    const order = await createOrder(
      ctx,
      { orderNumber: 'SO-1', lines: [{ skuId: master.sku.id, quantity: 4 }] },
      'FULFILLING',
    );

    const responses = await Promise.all(
      Array.from({ length: 3 }, () =>
        ctx.http().patch(`/orders/${order.id}/status`).send({ status: 'SHIPPED' }),
      ),
    );

    expect(responses.filter((response) => response.status === 200)).toHaveLength(1);
    for (const response of responses) {
      expect([200, 400, 409]).toContain(response.status);
    }
    expect(await onHand()).toBe(6);
    expect(await ctx.prisma.inventoryAdjustment.count()).toBe(1);
  });

  it('returns supply to other orders when an order is canceled', async () => {
    await setOnHand(ctx.prisma, master.sku.id, master.blr.id, 5);
    const first = await createOrder(ctx, {
      orderNumber: 'SO-1',
      priority: 'HIGH',
      lines: [{ skuId: master.sku.id, quantity: 5 }],
    });
    const second = await createOrder(ctx, {
      orderNumber: 'SO-2',
      lines: [{ skuId: master.sku.id, quantity: 5 }],
    });

    expect((await planLine(ctx, second.id))?.backorderedQuantity).toBe(5);

    await ctx
      .http()
      .patch(`/orders/${first.id}/status`)
      .send({ status: 'CANCELED' })
      .expect(200);

    expect(await planLine(ctx, first.id)).toBeUndefined();
    expect((await planLine(ctx, second.id))?.allocatedQuantity).toBe(5);
  });
});
