import type {
  ExceptionType,
  OrderStatus,
  Priority,
  ReceiptStatus,
  Severity,
} from '../../types';
import type { Tone } from './Badge';

export function humanize(value: string): string {
  const words = value.toLowerCase().split('_').join(' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export const ORDER_STATUS_TONE: Record<OrderStatus, Tone> = {
  DRAFT: 'neutral',
  CONFIRMED: 'info',
  FULFILLING: 'accent',
  SHIPPED: 'success',
  CANCELED: 'danger',
};

export const RECEIPT_STATUS_TONE: Record<ReceiptStatus, Tone> = {
  PLANNED: 'neutral',
  IN_TRANSIT: 'info',
  RECEIVED: 'success',
  CANCELED: 'danger',
};

export const SEVERITY_TONE: Record<Severity, Tone> = {
  HIGH: 'danger',
  MEDIUM: 'warning',
  LOW: 'info',
};

export const PRIORITY_TONE: Record<Priority, Tone> = {
  HIGH: 'danger',
  MED: 'warning',
  LOW: 'neutral',
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  HIGH: 'High',
  MED: 'Medium',
  LOW: 'Low',
};

export const EXCEPTION_TYPE_LABEL: Record<ExceptionType, string> = {
  BACKORDER: 'Backorder',
  LATE_PROMISE: 'Late promise',
  INBOUND_DEPENDENCY: 'Inbound dependency',
};

/** Chart colors for order statuses, as CSS variables. */
export const ORDER_STATUS_COLOR: Record<OrderStatus, string> = {
  DRAFT: 'var(--chart-6)',
  CONFIRMED: 'var(--chart-5)',
  FULFILLING: 'var(--chart-1)',
  SHIPPED: 'var(--chart-2)',
  CANCELED: 'var(--chart-4)',
};
