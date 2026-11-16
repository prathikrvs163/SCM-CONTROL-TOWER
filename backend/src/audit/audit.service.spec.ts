import { Prisma } from '../generated/prisma/client.js';
import { AuditService } from './audit.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';

describe('AuditService', () => {
  const create = vi.fn();
  const findMany = vi.fn();
  const prisma = { auditLog: { create, findMany } } as unknown as PrismaService;
  let service: AuditService;

  beforeEach(() => {
    create.mockReset().mockResolvedValue({});
    findMany.mockReset().mockResolvedValue([]);
    service = new AuditService(prisma);
  });

  it('stores before/after snapshots as plain JSON with the default actor', async () => {
    const eta = new Date('2026-11-20T00:00:00.000Z');

    await service.record(prisma, {
      entityType: 'INBOUND_RECEIPT',
      entityId: 'rcpt-1',
      entityRef: 'DEMO-RCV-001',
      action: 'RECEIPT_EXPEDITED',
      reason: 'Air freight',
      before: { expectedArrivalTime: eta, ignored: undefined },
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        entityType: 'INBOUND_RECEIPT',
        entityId: 'rcpt-1',
        entityRef: 'DEMO-RCV-001',
        action: 'RECEIPT_EXPEDITED',
        reason: 'Air freight',
        actor: 'planner',
        before: { expectedArrivalTime: '2026-11-20T00:00:00.000Z' },
        after: Prisma.DbNull,
      },
    });
  });

  it('writes through the transaction client it is given', async () => {
    const txCreate = vi.fn().mockResolvedValue({});

    await service.record(
      { auditLog: { create: txCreate } } as never,
      { entityType: 'ORDER', entityId: 'order-1', action: 'ORDER_SPLIT' },
    );

    expect(txCreate).toHaveBeenCalledTimes(1);
    expect(create).not.toHaveBeenCalled();
  });

  it('recordSafely swallows write failures', async () => {
    create.mockRejectedValue(new Error('database down'));
    const warn = vi
      .spyOn(service['logger'], 'warn')
      .mockImplementation(() => undefined);

    await expect(
      service.recordSafely({
        entityType: 'AI_INTERACTION',
        entityId: 'exception-summary',
        action: 'AI_EXCEPTION_SUMMARY',
      }),
    ).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
  });

  it('filters, orders newest first and caps the page size', async () => {
    await service.findAll({ entityType: 'ORDER', entityId: 'order-1', limit: 10_000 });

    expect(findMany).toHaveBeenCalledWith({
      where: { entityType: 'ORDER', entityId: 'order-1' },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 500,
    });
  });
});
