import { describe, expect, it } from 'vitest';
import {
  describeAuditChanges,
  formatAuditAction,
  formatAuditValue,
} from './auditFormat';

describe('audit formatting', () => {
  it('labels known actions and humanizes unknown ones', () => {
    expect(formatAuditAction('RECEIPT_EXPEDITED')).toBe('Receipt expedited');
    expect(formatAuditAction('ORDER_SPLIT')).toBe('Shipment split');
    expect(formatAuditAction('SOMETHING_NEW')).toBe('Something new');
  });

  it('formats empty values, dates and objects', () => {
    expect(formatAuditValue(null)).toBe('—');
    expect(formatAuditValue(12)).toBe('12');
    expect(formatAuditValue({ a: 1 })).toBe('{"a":1}');
    expect(formatAuditValue('2026-11-20T00:00:00.000Z')).toBe(
      new Date('2026-11-20T00:00:00.000Z').toLocaleString(),
    );
    expect(formatAuditValue('HYD')).toBe('HYD');
  });

  it('lists only fields that changed', () => {
    expect(
      describeAuditChanges({
        before: { skuCode: 'SKU-A', preferredWarehouseCode: 'HYD' },
        after: { skuCode: 'SKU-A', preferredWarehouseCode: 'CHN' },
      }),
    ).toEqual([{ field: 'preferredWarehouseCode', before: 'HYD', after: 'CHN' }]);
  });

  it('shows one-sided fields with null on the missing side', () => {
    expect(
      describeAuditChanges({
        before: null,
        after: { status: 'DRAFT' },
      }),
    ).toEqual([{ field: 'status', before: null, after: 'DRAFT' }]);
  });
});
