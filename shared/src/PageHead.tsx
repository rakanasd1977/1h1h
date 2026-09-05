import { type ReactNode } from 'react';

export function PageHead({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className={`page-head${actions ? ' flex-between' : ''}`}>
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}
