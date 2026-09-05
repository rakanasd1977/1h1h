import { useEffect, useState } from 'react';
import { api } from '../api';
import { useToast, fmt, fmtDate, PageLoading, EmptyState, Badge, Pagination, DISPUTE_STATUS } from '@rafidain/shared/ui';
import { PageHead } from '@rafidain/shared/ui';
import { t } from '@rafidain/shared/i18n';
import { useLocale } from '@rafidain/shared';

export default function Disputes() {
  useLocale();
  const [rows, setRows] = useState<any>(null);
  const [meta, setMeta] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [drawer, setDrawer] = useState<any>(null);
  const [decision, setDecision] = useState('');
  const [refund, setRefund] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const load = (pg = page) => {
    const p = new URLSearchParams();
    if (status) p.set('status', status);
    p.set('page', String(pg));
    p.set('limit', '20');
    api.get(`/disputes?${p}`).then((r) => { setRows(r.data); setMeta(r.meta || null); }).catch((e) => toast.error(e.message));
  };
  useEffect(() => { load(); }, [page, status]);
  useEffect(() => { setPage(1); }, [status]);

  const openDecide = (d: any, kind: any) => {
    setDrawer(d);
    setDecision(kind);
    setRefund(kind === 'resolved' ? String(d.total_amount) : '');
    setNote('');
  };

  const decide = async () => {
    setSaving(true);
    try {
      await api.post(`/disputes/${drawer.id}/resolve`, {
        status: decision,
        refund_amount: decision === 'resolved' ? Number(refund) || 0 : undefined,
        note: note.trim() || undefined,
      });
      toast.success(decision === 'resolved' ? t('ad.disputes.resolved') : t('ad.disputes.rejected'));
      setDrawer(null);
      load();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  if (!rows) return <PageLoading />;

  return (
    <div>
      <PageHead title={t('ad.disputes.title')} subtitle={t('ad.disputes.subtitle')} />

      <div className="filters">
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{t('ad.disputes.allStatuses')}</option>
          <option value="open">{t('ad.disputes.statusOpen')}</option>
          <option value="reviewing">{t('ad.disputes.statusReviewing')}</option>
          <option value="resolved">{t('ad.disputes.statusResolved')}</option>
          <option value="rejected">{t('ad.disputes.statusRejected')}</option>
        </select>
      </div>

      <div className="card">
        <div className="table-wrap">
          {rows.length === 0 ? <EmptyState text={t('ad.disputes.empty')} icon="⚖️" /> : (
            <table>
              <thead>
                <tr>
                  <th>#</th><th>{t('ad.orders.orderNumber')}</th><th>{t('ad.disputes.customer')}</th><th>{t('ad.orders.provider')}</th>
                  <th>{t('ad.wallet.amount')}</th><th>{t('ad.disputes.reason')}</th><th>{t('ad.common.status')}</th><th>{t('ad.orders.date')}</th><th>{t('ad.common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((d: any) => (
                  <tr key={d.id}>
                    <td className="mono muted">{d.id}</td>
                    <td className="bold">{d.order_number}</td>
                    <td>{d.opened_by_name}</td>
                    <td>{d.provider_name}</td>
                    <td className="bold">{fmt(d.total_amount)}</td>
                    <td className="muted" style={{ maxWidth: 220 }}>{d.reason}</td>
                    <td><Badge status={d.status} map={DISPUTE_STATUS} /></td>
                    <td className="muted">{fmtDate(d.created_at)}</td>
                    <td>
                      {['open', 'reviewing'].includes(d.status) ? (
                        <div className="flex" style={{ gap: 6 }}>
                          <button className="btn btn-outline btn-sm" onClick={() => openDecide(d, 'resolved')}>{t('ad.disputes.resolveBtn')}</button>
                          <button className="btn btn-danger btn-sm" onClick={() => openDecide(d, 'rejected')}>{t('ad.disputes.rejectBtn')}</button>
                        </div>
                      ) : (
                        <span className="muted">{d.resolution || '-'}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Pagination meta={meta} page={page} onChange={setPage} />

      {drawer && (
        <div className="modal-backdrop" onClick={() => setDrawer(null)}>
          <div className="modal card" onClick={(e: any) => e.stopPropagation()}>
            <h3>{decision === 'resolved' ? t('ad.disputes.resolveTitle') : t('ad.disputes.rejectTitle')}</h3>
            <div className="muted" style={{ margin: '6px 0 12px' }}>
              {t('ad.disputes.confirmMessage', { order: drawer.order_number, total: fmt(drawer.total_amount) })}
            </div>
            {decision === 'resolved' && (
              <label className="field-label">{t('ad.disputes.refund')}
                <input type="number" className="input" value={refund} onChange={(e) => setRefund(e.target.value)} />
              </label>
            )}
            <textarea className="input" rows={3} style={{ marginTop: 10 }} placeholder={t('ad.disputes.notePlaceholder')} value={note} onChange={(e) => setNote(e.target.value)} />
            <div className="flex" style={{ gap: 8, marginTop: 14 }}>
              <button className="btn btn-primary btn-sm" onClick={decide} disabled={saving}>
                {saving ? '...' : (decision === 'resolved' ? t('ad.disputes.yesResolve') : t('ad.disputes.yesReject'))}
              </button>
              <button className="btn btn-outline btn-sm" onClick={() => setDrawer(null)}>{t('ad.common.cancel')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}