import type { ReactNode } from 'react';
import { cx } from './cx';

interface CardProps {
  className?: string;
  children: ReactNode;
  as?: 'section' | 'div' | 'article';
  'aria-label'?: string;
}

export function Card({
  className,
  children,
  as: Tag = 'section',
  ...rest
}: CardProps) {
  return (
    <Tag className={cx('card', className)} {...rest}>
      {children}
    </Tag>
  );
}

interface CardHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  /** Heading level for the title; defaults to h2. */
  level?: 2 | 3;
}

export function CardHeader({
  title,
  description,
  icon,
  actions,
  level = 2,
}: CardHeaderProps) {
  const Heading = level === 2 ? 'h2' : 'h3';

  return (
    <div className="card-header">
      <div className="card-header-main">
        {icon && <span className="card-header-icon">{icon}</span>}
        <div>
          <Heading className="card-title">{title}</Heading>
          {description && <p className="card-description">{description}</p>}
        </div>
      </div>
      {actions && <div className="btn-group">{actions}</div>}
    </div>
  );
}

export function CardBody({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cx('card-body', className)}>{children}</div>;
}

export function CardFooter({ children }: { children: ReactNode }) {
  return <div className="card-footer">{children}</div>;
}
