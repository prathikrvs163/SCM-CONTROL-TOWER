import type { CSSProperties, ReactNode } from 'react';
import type { Tone } from './Badge';
import { cx } from './cx';

interface StatCardProps {
  label: string;
  value: ReactNode;
  suffix?: string;
  icon?: ReactNode;
  tone?: Tone;
  hint?: ReactNode;
  /** Extra content under the value, such as a meter. */
  footer?: ReactNode;
  /** Makes the card a toggle button, used for filter cards. */
  onClick?: () => void;
  active?: boolean;
  /** Stagger index for the entrance animation. */
  index?: number;
}

export function StatCard({
  label,
  value,
  suffix,
  icon,
  tone = 'neutral',
  hint,
  footer,
  onClick,
  active = false,
  index = 0,
}: StatCardProps) {
  const style = { animationDelay: `${index * 40}ms` } as CSSProperties;

  const content = (
    <>
      <div className="stat-card-top">
        <span className="stat-label">{label}</span>
        {icon && <span className="stat-icon">{icon}</span>}
      </div>
      <div className="stat-value">
        {value}
        {suffix && <span className="stat-value-suffix">{suffix}</span>}
      </div>
      {footer}
      {hint && <div className="stat-hint">{hint}</div>}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        className={cx('stat-card', active && 'is-active')}
        data-tone={tone}
        style={style}
        onClick={onClick}
        aria-pressed={active}
      >
        {content}
      </button>
    );
  }

  return (
    <div className="stat-card" data-tone={tone} style={style}>
      {content}
    </div>
  );
}
