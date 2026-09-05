import { useEffect, useState } from 'react';
import { api } from '../api';
import { useToast, fmt, fmtDate, PageLoading, EmptyState, Confirm, Badge, Pagination, WITHDRAWAL_STATUS } from '@rafidain/shared/ui';
import { PageHead } from '@rafidain/shared/ui';
import { t } from '@rafidain/shared/i18n';
import { useLocale } from '@rafidain/shared';

export default function AgentWithdrawals() {
  useLocale();
  const [rows, setRows] = useState<any>(null);
  const [meta, setMeta] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [deciding, setDeciding] = useState<any>(null);
  const [decision, setDecision] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const load = (pg = page) => {
    const p = new URLSearchParams();
    if (status) p.set('status', status);
    p.set('page', String(pg));
    p.set('limit', '20');
    api.get(`/agent-withdrawals?${p}`).then((r) => { setRows(r.data); setMeta(r.meta || null); }).catch((e) => toast.error(e.message));
  };
  useEffect(() => { load(); }, [page, status]);
  useEffect(() => { setPage(1); }, [status]);

  const openDecision = (w: any, d: any) => {
    setDeciding(w);
    setDecision(d);
    setNotes('');
  };

  const decide = async () => {
    setSaving(true);
    try {
      await api.post(`/agent-withdrawals/${deciding.id}/decision`, { decision, notes: notes.trim() || undefined });
      toast.success(decision === 'approved' ? t('ad.aw.approved') : t('ad.aw.rejected'));
      setDeciding(null);
      load();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  if (!rows) return <PageLoading />;

  return (
    <div>
      <PageHead title={t('ad.aw.title')} subtitle={t('ad.aw.subtitle')} />

      <div className="filters">
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{t('ad.aw.allStatuses')}</option>
          <option value="pending">{t('ad.aw.statusPending')}</option>
          <option value="approved">{t('ad.aw.statusApproved')}</option>
          <option value="rejected">{t('ad.aw.statusRejected')}</option>
        </select>
      </div>

      <div className="card">
        <div className="table-wrap">
          {rows.length === 0 ? <EmptyState text={t('ad.aw.empty')} icon="🏦" /> : (
            <table>
              <thead>
                <tr>
                  <th>#</th><th>{t('ad.agent.agent')}</th><th>{t('ad.agent.gov')}</th><th>{t('ad.wallet.amount')}</th>
                  <th>{t('ad.wallet.note')}</th><th>{t('ad.common.status')}</th><th>{t('ad.orders.date')}</th><th>{t('ad.common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((w: any) => (
                  <tr key={w.id}>
                    <td className="mono muted">{w.id}</td>
                    <td>
                      <div className="bold">{w.agent_name_ar}</div>
                      <div className="muted" style={{ fontSize: 11 }}>{w.agent_email}</div>
                    </td>
                    <td>{w.governorate_name_ar}</td>
                    <td className="bold">{fmt(w.amount)}</td>
                    <td className="muted" style={{ maxWidth: 180 }}>{w.notes || '-'}</td>
                    <td><Badge status={w.status} map={WITHDRAWAL_STATUS} /></td>
                    <td className="muted">{fmtDate(w.created_at)}</td>
                    <td>
                      {w.status === 'pending' ? (
                        <div className="flex" style={{ gap: 6 }}>
                          <button className="btn btn-outline btn-sm" onClick={() => openDecision(w, 'approved')}>{t('ad.aw.approveBtn')}</button>
                          <button className="btn btn-danger btn-sm" onClick={() => openDecision(w, 'rejected')}>{t('ad.aw.rejectBtn')}</button>
                        </div>
                      ) : (
                        <span className="muted">{w.decided_by_name ? `${t('ad.aw.decisionBy')} ${w.decided_by_name}` : '-'}</span>
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

      <Confirm
        open={!!deciding}
        title={decision === 'approved' ? t('ad.aw.confirmApproveTitle') : t('ad.aw.confirmRejectTitle')}
        message={deciding ? t('ad.aw.confirmMessage', { decision: decision === 'approved' ? t('ad.aw.approveBtn') : t('ad.aw.rejectBtn'), amount: fmt(deciding.amount), name: deciding.agent_name_ar }) : ''}
        confirmText={decision === 'approved' ? t('ad.aw.yesApprove') : t('ad.aw.yesReject')}
        danger={decision === 'rejected'}
        onConfirm={decide}
        onCancel={() => setDeciding(null)}
      />
    </div>
  );
}
