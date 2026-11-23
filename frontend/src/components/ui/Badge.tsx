import type { ReactNode } from 'react';
import { cx } from './cx';

export type Tone =
  | 'neutral'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'accent';

interface BadgeProps {
  tone?: Tone;
  dot?: boolean;
  /** Pulse the dot, for live or urgent states. */
  pulse?: boolean;
  icon?: ReactNode;
  className?: string;
  title?: string;
  children: ReactNode;
}

export function Badge({
  tone = 'neutral',
  dot = false,
  pulse = false,
  icon,
  className,
  title,
  children,
}: BadgeProps) {
  return (
    <span
      className={cx(
        'badge',
        tone !== 'neutral' && `badge-${tone}`,
        pulse && 'badge-pulse',
        className,
      )}
      title={title}
    >
      {dot && <span className="badge-dot-mark" aria-hidden="true" />}
      {icon}
      {children}
    </span>
  );
}
