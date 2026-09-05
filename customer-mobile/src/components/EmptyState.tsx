import type { ReactNode } from 'react';
import { useLocale, t } from '@rafidain/shared';

export function EmptyState({ icon = '🗂️', title, sub = '', action = null }: { icon?: string; title?: string; sub?: string; action?: ReactNode }) {
  useLocale();
  return (
    <div className="empty">
      <div className="empty__icon">{icon}</div>
      <div className="empty__title">{title ?? t('empty.title')}</div>
      {sub && <div className="empty__sub">{sub}</div>}
      {action}
    </div>
  );
}
