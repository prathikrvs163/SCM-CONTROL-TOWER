import type { AuditLogEntry } from '../../types';

const ACTION_LABELS: Record<string, string> = {
  RECEIPT_CREATED: 'Receipt created',
  RECEIPT_UPDATED: 'Receipt edited',
  RECEIPT_DISPATCHED: 'Receipt dispatched',
  RECEIPT_CANCELED: 'Receipt canceled',
  RECEIPT_RECEIVED: 'Receipt received',
  RECEIPT_EXPEDITED: 'Receipt expedited',
  ORDER_CREATED: 'Order created',
  ORDER_UPDATED: 'Draft order edited',
  ORDER_STATUS_CHANGED: 'Status changed',
  ORDER_SHIPPED: 'Order shipped',
  LINE_FULFILLMENT_REASSIGNED: 'Fulfillment location reassigned',
  PROMISE_DATE_OVERRIDDEN: 'Promise date overridden',
  PROMISE_OVERRIDE_CLEARED: 'Promise override cleared',
  ORDER_SPLIT: 'Shipment split',
  ORDER_CREATED_FROM_SPLIT: 'Created from split',
  AI_EXCEPTION_SUMMARY: 'AI exception summary',
  AI_CUSTOMER_DRAFT: 'AI customer draft',
};

export const ENTITY_LABELS: Record<AuditLogEntry['entityType'], string> = {
  INBOUND_RECEIPT: 'Receipt',
  ORDER: 'Order',
  AI_INTERACTION: 'AI',
};

export function formatAuditAction(action: string): string {
  if (ACTION_LABELS[action]) return ACTION_LABELS[action];

  const words = action.toLowerCase().split('_').join(' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

/** Render one stored JSON value for display. */
export function formatAuditValue(value: unknown): string {
  if (value === null || value === undefined) return '—';

  if (typeof value === 'string') {
    return ISO_DATE.test(value) ? new Date(value).toLocaleString() : value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return JSON.stringify(value);
}

export interface AuditChange {
  field: string;
  before: string | null;
  after: string | null;
}

/**
 * Field-level differences between the before and after snapshots. Fields
 * with the same value on both sides are left out; a field present on only
 * one side is shown with the other side as null.
 */
export function describeAuditChanges(
  entry: Pick<AuditLogEntry, 'before' | 'after'>,
): AuditChange[] {
  const before = entry.before ?? {};
  const after = entry.after ?? {};
  const fields = [...new Set([...Object.keys(before), ...Object.keys(after)])];

  return fields
    .filter(
      (field) => JSON.stringify(before[field]) !== JSON.stringify(after[field]),
    )
    .map((field) => ({
      field,
      before: field in before ? formatAuditValue(before[field]) : null,
      after: field in after ? formatAuditValue(after[field]) : null,
    }));
}
