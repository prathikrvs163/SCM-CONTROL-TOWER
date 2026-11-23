import type { ReactNode } from 'react';

interface PageHeaderProps {
  eyebrow?: string;
  eyebrowIcon?: ReactNode;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({
  eyebrow,
  eyebrowIcon,
  title,
  description,
  actions,
}: PageHeaderProps) {
  return (
    <header className="page-header">
      <div>
        {eyebrow && (
          <p className="page-eyebrow">
            {eyebrowIcon}
            {eyebrow}
          </p>
        )}
        <h1>{title}</h1>
        {description && <p className="page-description">{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}
