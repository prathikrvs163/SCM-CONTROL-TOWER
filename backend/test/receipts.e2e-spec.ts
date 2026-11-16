import {
  auditActions,
  createReceipt,
  createTestApp,
  daysFromToday,
  resetDatabase,
  seedMasterData,
  setOnHand,
} from './support/test-app.js';
import type { TestContext } from './support/test-app.js';

describe('Inbound receipts API (real database)', () => {
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

  async function newReceipt(quantity = 20) {
    return createReceipt(ctx, {
      receiptId: 'RCV-1',
      skuId: master.sku.id,
      warehouseId: master.blr.id,
      quantity,
      expectedArrivalTime: daysFromToday(3),
    });
  }

  it('receives into on-hand, logs the movement and audits the lifecycle', async () => {
    await setOnHand(ctx.prisma, master.sku.id, master.blr.id, 5);
    const receipt = await newReceipt(20);

    await ctx
      .http()
      .patch(`/inbound-receipts/${receipt.id}/status`)
      .send({ status: 'IN_TRANSIT' })
      .expect(200);

    const received = await ctx
      .http()
      .post(`/inbound-receipts/${receipt.id}/receive`)
      .expect(201);

    expect(received.body.status).toBe('RECEIVED');
    expect(received.body.receivedAt).not.toBeNull();
    expect(await onHand()).toBe(25);

    const adjustments = await ctx.prisma.inventoryAdjustment.findMany();
    expect(adjustments).toEqual([
      expect.objectContaining({
        quantityChange: 20,
        reason: 'Inbound receipt received: RCV-1',
      }),
    ]);

    expect(await auditActions(ctx, 'INBOUND_RECEIPT', receipt.id)).toEqual([
      'RECEIPT_CREATED',
      'RECEIPT_DISPATCHED',
      'RECEIPT_RECEIVED',
    ]);
  });

  it('creates the inventory row when the warehouse had none', async () => {
    const receipt = await newReceipt(7);

    await ctx.http().post(`/inbound-receipts/${receipt.id}/receive`).expect(201);

    expect(await onHand()).toBe(7);
  });

  it('is idempotent: receiving twice adds the stock once', async () => {
    const receipt = await newReceipt(20);

    await ctx.http().post(`/inbound-receipts/${receipt.id}/receive`).expect(201);
    const second = await ctx
      .http()
      .post(`/inbound-receipts/${receipt.id}/receive`)
      .expect(201);

    expect(second.body.status).toBe('RECEIVED');
    expect(await onHand()).toBe(20);
    expect(await ctx.prisma.inventoryAdjustment.count()).toBe(1);
  });

  it('adds the stock exactly once under concurrent receive calls', async () => {
    const receipt = await newReceipt(20);

    const responses = await Promise.all(
      Array.from({ length: 5 }, () =>
        ctx.http().post(`/inbound-receipts/${receipt.id}/receive`),
      ),
    );

    // Each call either receives, returns the already-received receipt, or
    // loses the claim race with a 409. None may add stock twice.
    for (const response of responses) {
      expect([201, 409]).toContain(response.status);
    }
    expect(responses.some((response) => response.status === 201)).toBe(true);
    expect(await onHand()).toBe(20);
    expect(await ctx.prisma.inventoryAdjustment.count()).toBe(1);
    expect(
      await ctx.prisma.auditLog.count({ where: { action: 'RECEIPT_RECEIVED' } }),
    ).toBe(1);
  });

  it('rejects receiving a canceled receipt and changing a closed one', async () => {
    const canceled = await newReceipt(10);
    await ctx
      .http()
      .patch(`/inbound-receipts/${canceled.id}/status`)
      .send({ status: 'CANCELED' })
      .expect(200);

    await ctx
      .http()
      .post(`/inbound-receipts/${canceled.id}/receive`)
      .expect(400);
    await ctx
      .http()
      .patch(`/inbound-receipts/${canceled.id}`)
      .send({ quantity: 99 })
      .expect(400);
    await ctx
      .http()
      .patch(`/inbound-receipts/${canceled.id}/status`)
      .send({ status: 'IN_TRANSIT' })
      .expect(400);

    expect(await onHand()).toBe(0);
  });

  it('only lets planned receipts move to in-transit', async () => {
    const receipt = await newReceipt(10);

    await ctx
      .http()
      .patch(`/inbound-receipts/${receipt.id}/status`)
      .send({ status: 'IN_TRANSIT' })
      .expect(200);
    await ctx
      .http()
      .patch(`/inbound-receipts/${receipt.id}/status`)
      .send({ status: 'IN_TRANSIT' })
      .expect(400);
  });

  it('audits edits with before and after values', async () => {
    const receipt = await newReceipt(10);

    await ctx
      .http()
      .patch(`/inbound-receipts/${receipt.id}`)
      .send({ quantity: 12 })
      .expect(200);

    const [entry] = await ctx.prisma.auditLog.findMany({
      where: { action: 'RECEIPT_UPDATED' },
    });
    expect(entry.before).toMatchObject({ quantity: 10 });
    expect(entry.after).toMatchObject({ quantity: 12 });
  });

  it('validates input and rejects duplicate receipt IDs', async () => {
    await ctx
      .http()
      .post('/inbound-receipts')
      .send({
        receiptId: 'RCV-BAD',
        skuId: master.sku.id,
        warehouseId: master.blr.id,
        quantity: 0,
        expectedArrivalTime: daysFromToday(1).toISOString(),
      })
      .expect(400);

    await ctx
      .http()
      .post('/inbound-receipts')
      .send({
        receiptId: 'RCV-BAD',
        skuId: master.sku.id,
        warehouseId: master.blr.id,
        quantity: 1,
        expectedArrivalTime: daysFromToday(1).toISOString(),
        status: 'RECEIVED',
      })
      .expect(400);

    await newReceipt(5);
    await ctx
      .http()
      .post('/inbound-receipts')
      .send({
        receiptId: 'RCV-1',
        skuId: master.sku.id,
        warehouseId: master.blr.id,
        quantity: 5,
        expectedArrivalTime: daysFromToday(1).toISOString(),
      })
      .expect(409);

    await ctx.http().post('/inbound-receipts/does-not-exist/receive').expect(404);
  });
});
