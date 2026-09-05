import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { Spinner } from '../components/Spinner';
import { formatDateTime } from '../format';
import { useLocale, t } from '@rafidain/shared';

const STATUS_LABEL: Record<string, string> = {
  open: 'status.dispute.open',
  reviewing: 'status.dispute.reviewing',
  resolved: 'status.dispute.resolved',
  rejected: 'status.dispute.rejected',
};

export default function Disputes() {
  useLocale();
  const navigate = useNavigate();
  const [items, setItems] = useState<any>(null);

  useEffect(() => {
    api.get('/disputes?limit=50').then((r: any) => setItems(Array.isArray(r) ? r : (r?.data || []))).catch(() => setItems([]));
  }, []);

  return (
    <div className="page">
      <PageHeader title={t('dispute.listTitle')} />
      {!items ? (
        <div className="centerpad"><Spinner /></div>
      ) : items.length === 0 ? (
        <EmptyState icon="⚖️" title={t('dispute.listEmpty')} sub={t('dispute.listEmptySub')} />
      ) : (
        <div className="card" style={{ padding: 0 }}>
          {items.map((d: any, idx: number) => (
            <button
              key={d.id}
              type="button"
              style={{ width: '100%', textAlign: 'right', padding: 12, borderBottom: idx < items.length - 1 ? '1px solid var(--border, #eef1f5)' : 'none', display: 'block' }}
              onClick={() => d.order_id && navigate(`/orders/${d.order_id}`)}
            >
              <div className="row row--between">
                <span style={{ fontWeight: 700, fontSize: 14 }}>{d.order_number}</span>
                <span style={{ fontSize: 12, color: 'var(--muted, #666)' }}>{t(STATUS_LABEL[d.status] || d.status)}</span>
              </div>
              <span className="muted" style={{ fontSize: 13, display: 'block', marginTop: 4 }}>{d.reason}</span>
              <div className="row row--between" style={{ marginTop: 6 }}>
                <span className="muted" style={{ fontSize: 11 }}>{formatDateTime(d.created_at)}</span>
                {d.status === 'resolved' && d.refund_amount > 0 && <span style={{ fontSize: 12 }}>🔄 {d.refund_amount}</span>}
                {d.resolution && <span className="muted" style={{ fontSize: 12, maxLines: 1 }}>{d.resolution}</span>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}