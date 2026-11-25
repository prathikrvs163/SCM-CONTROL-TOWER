import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('HealthController', () => {
  let controller: HealthController;

  const prisma = {
    $queryRaw: vi.fn(),
  };

  beforeEach(() => {
    vi.resetAllMocks();

    controller = new HealthController(
      prisma as unknown as PrismaService,
    );
  });

  it('should report that the application is alive', () => {
    const result = controller.liveness();

    expect(result.status).toBe('ok');
    expect(result.timestamp).toBeDefined();
    expect(result.uptime).toBeGreaterThanOrEqual(0);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('should report readiness when the database is connected', async () => {
    prisma.$queryRaw.mockResolvedValue([{ 1: 1 }]);

    const result = await controller.readiness();

    expect(result.status).toBe('ok');
    expect(result.database).toBe('connected');
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('should return service unavailable when the database fails', async () => {
    prisma.$queryRaw.mockRejectedValue(
      new Error('Database connection failed'),
    );

    await expect(controller.readiness()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('should remain alive even when the database is unavailable', async () => {
    prisma.$queryRaw.mockRejectedValue(
      new Error('Database unavailable'),
    );

    await expect(controller.readiness()).rejects.toThrow();

    expect(controller.liveness().status).toBe('ok');
  });
}); 