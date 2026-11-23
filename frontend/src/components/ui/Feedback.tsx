import type { CSSProperties, ReactNode } from 'react';
import {
  CircleAlert,
  CircleCheck,
  Info,
  TriangleAlert,
} from 'lucide-react';
import { cx } from './cx';

/* ---------- Skeletons ---------- */

export function Skeleton({
  width = '100%',
  height = 12,
  className,
  style,
}: {
  width?: number | string;
  height?: number | string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      className={cx('skeleton', className)}
      style={{ width, height, ...style }}
      aria-hidden="true"
    />
  );
}

/** Placeholder rows shaped like a table while data loads. */
export function TableSkeleton({
  rows = 6,
  columns = 5,
}: {
  rows?: number;
  columns?: number;
}) {
  const template = `1.4fr repeat(${Math.max(columns - 1, 1)}, 1fr)`;

  return (
    <div className="skeleton-table" role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, row) => (
        <div
          key={row}
          className="skeleton-row"
          style={{ gridTemplateColumns: template }}
        >
          {Array.from({ length: columns }, (_, column) => (
            <Skeleton
              key={column}
              height={column === 0 ? 14 : 11}
              width={`${column === 0 ? 70 : 45 + ((row * 7 + column * 13) % 40)}%`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/* ---------- Empty state ---------- */

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  compact = false,
}: EmptyStateProps) {
  return (
    <div className={cx('empty-state', compact && 'is-compact')}>
      {icon && <div className="empty-state-icon">{icon}</div>}
      <p className="empty-state-title">{title}</p>
      {description && (
        <p className="empty-state-description">{description}</p>
      )}
      {action && <div className="empty-state-action">{action}</div>}
    </div>
  );
}

/* ---------- Alert ---------- */

type AlertTone = 'danger' | 'warning' | 'success' | 'info' | 'accent';

const ALERT_ICON: Record<AlertTone, ReactNode> = {
  danger: <CircleAlert />,
  warning: <TriangleAlert />,
  success: <CircleCheck />,
  info: <Info />,
  accent: <Info />,
};

interface AlertProps {
  tone?: AlertTone;
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}

export function Alert({
  tone = 'info',
  title,
  children,
  action,
  icon,
  className,
}: AlertProps) {
  return (
    <div
      className={cx('alert', `alert-${tone}`, className)}
      role={tone === 'danger' ? 'alert' : 'status'}
    >
      {icon ?? ALERT_ICON[tone]}
      <div className="alert-content">
        {title && <div className="alert-title">{title}</div>}
        {children}
      </div>
      {action && <div className="alert-action">{action}</div>}
    </div>
  );
}

/* ---------- Meters ---------- */

interface MeterProps {
  value: number;
  max: number;
  tone?: 'accent' | 'success' | 'warning' | 'danger';
  /** Optional marker position, such as a safety-stock threshold. */
  marker?: number;
  label?: string;
}

export function Meter({
  value,
  max,
  tone = 'accent',
  marker,
  label,
}: MeterProps) {
  const safeMax = max > 0 ? max : 1;
  const pct = Math.min(100, Math.max(0, (value / safeMax) * 100));
  const markerPct =
    marker !== undefined
      ? Math.min(100, Math.max(0, (marker / safeMax) * 100))
      : null;

  return (
    <div
      className="meter"
      data-tone={tone}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={safeMax}
      aria-valuenow={value}
      aria-label={label}
    >
      <div className="meter-fill" style={{ width: `${pct}%` }} />
      {markerPct !== null && (
        <span className="meter-marker" style={{ left: `${markerPct}%` }} />
      )}
    </div>
  );
}

export interface BarSegment {
  value: number;
  color: string;
  label: string;
}

/** A horizontal bar split into proportional colored segments. */
export function StackedBar({
  segments,
  total,
  label,
}: {
  segments: BarSegment[];
  total?: number;
  label?: string;
}) {
  const sum = total ?? segments.reduce((acc, item) => acc + item.value, 0);
  const visible = segments.filter((item) => item.value > 0);

  return (
    <div
      className="stacked-bar"
      role="img"
      aria-label={
        label ??
        visible.map((item) => `${item.label}: ${item.value}`).join(', ')
      }
    >
      {sum > 0 &&
        visible.map((item) => (
          <span
            key={item.label}
            className="stacked-bar-segment"
            style={{
              width: `${(item.value / sum) * 100}%`,
              background: item.color,
            }}
            title={`${item.label}: ${item.value.toLocaleString()}`}
          />
        ))}
    </div>
  );
}
