import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from './cx';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'danger'
  | 'danger-ghost';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md';
  icon?: ReactNode;
  iconRight?: ReactNode;
  /** Shows a spinner in place of the icon and disables the button. */
  loading?: boolean;
}

export function Spinner({ className }: { className?: string }) {
  return <span className={cx('spinner', className)} aria-hidden="true" />;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  iconRight,
  loading = false,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  const iconOnly = !children;

  return (
    <button
      type={type}
      className={cx(
        'btn',
        `btn-${variant}`,
        size === 'sm' && 'btn-sm',
        iconOnly && 'btn-icon-only',
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner /> : icon}
      {children}
      {!loading && iconRight}
    </button>
  );
}
