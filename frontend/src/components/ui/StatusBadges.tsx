import type {
  OrderStatus,
  Priority,
  ReceiptStatus,
  Severity,
} from '../../types';
import { Badge } from './Badge';
import {
  humanize,
  ORDER_STATUS_TONE,
  PRIORITY_LABEL,
  PRIORITY_TONE,
  RECEIPT_STATUS_TONE,
  SEVERITY_TONE,
} from './status';

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <Badge tone={ORDER_STATUS_TONE[status]} dot>
      {humanize(status)}
    </Badge>
  );
}

export function ReceiptStatusBadge({ status }: { status: ReceiptStatus }) {
  return (
    <Badge
      tone={RECEIPT_STATUS_TONE[status]}
      dot
      pulse={status === 'IN_TRANSIT'}
    >
      {humanize(status)}
    </Badge>
  );
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <Badge tone={SEVERITY_TONE[severity]} dot pulse={severity === 'HIGH'}>
      {humanize(severity)}
    </Badge>
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <Badge tone={PRIORITY_TONE[priority]} className="badge-outline">
      {PRIORITY_LABEL[priority]}
    </Badge>
  );
}

export function ActiveBadge({ active }: { active: boolean }) {
  return (
    <Badge tone={active ? 'success' : 'neutral'} dot>
      {active ? 'Active' : 'Inactive'}
    </Badge>
  );
}
