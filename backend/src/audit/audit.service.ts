import { Injectable, Logger } from '@nestjs/common';

import {
  AuditEntityType,
  Prisma,
} from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

export { AuditEntityType };

/** Default actor until the API has authentication. */
export const DEFAULT_AUDIT_ACTOR = 'planner';

export const AUDIT_LIST_DEFAULT_LIMIT = 100;
export const AUDIT_LIST_MAX_LIMIT = 500;

export interface AuditEntry {
  entityType: AuditEntityType;
  entityId: string;
  entityRef?: string | null;
  action: string;
  reason?: string | null;
  actor?: string;
  before?: unknown;
  after?: unknown;
}

export interface AuditFilters {
  entityType?: AuditEntityType;
  entityId?: string;
  action?: string;
  limit?: number;
}

/** Either the root client or a client inside `$transaction`. */
type AuditWriter = Pick<Prisma.TransactionClient, 'auditLog'>;

/**
 * Convert a value to plain JSON: Dates become ISO strings and undefined
 * fields are dropped, so the stored snapshot matches what the API returns.
 */
function toJson(
  value: unknown,
): Prisma.InputJsonValue | typeof Prisma.DbNull {
  if (value === undefined || value === null) {
    return Prisma.DbNull;
  }

  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Write an audit entry. Pass the transaction client so the entry is
   * committed or rolled back together with the change it describes.
   */
  record(client: AuditWriter, entry: AuditEntry) {
    return client.auditLog.create({
      data: {
        entityType: entry.entityType,
        entityId: entry.entityId,
        entityRef: entry.entityRef ?? null,
        action: entry.action,
        reason: entry.reason ?? null,
        actor: entry.actor ?? DEFAULT_AUDIT_ACTOR,
        before: toJson(entry.before),
        after: toJson(entry.after),
      },
    });
  }

  /**
   * Write an entry outside any transaction and never throw. Used for
   * read-only events (AI generations) where a failed audit write must not
   * hide the result from the user.
   */
  async recordSafely(entry: AuditEntry) {
    try {
      await this.record(this.prisma, entry);
    } catch (error) {
      this.logger.warn(
        `Failed to write audit entry ${entry.action} for ${entry.entityType} ${entry.entityId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  findAll(filters: AuditFilters = {}) {
    const limit = Math.min(
      Math.max(filters.limit ?? AUDIT_LIST_DEFAULT_LIMIT, 1),
      AUDIT_LIST_MAX_LIMIT,
    );

    return this.prisma.auditLog.findMany({
      where: {
        ...(filters.entityType ? { entityType: filters.entityType } : {}),
        ...(filters.entityId ? { entityId: filters.entityId } : {}),
        ...(filters.action ? { action: filters.action } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
    });
  }
}
