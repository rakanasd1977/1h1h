import { useEffect, useState } from 'react';
import { api } from '../api';
import { useToast, fmt, fmtDate, PageLoading, EmptyState, Confirm, Modal, Field, Pagination } from '@rafidain/shared/ui';
import { PageHead } from '@rafidain/shared/ui';
import { t } from '@rafidain/shared/i18n';
import { useLocale } from '@rafidain/shared';

function toDateInput(s: any) {
  if (!s) return '';
  const d = new Date(s);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

export default function Leases() {
  useLocale();
  const [rows, setRows] = useState<any>(null);
  const [meta, setMeta] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [agents, setAgents] = useState<any[]>([]);
  const [toApprove, setToApprove] = useState<any>(null);
  const [toReject, setToReject] = useState<any>(null);
  const [toCancel, setToCancel] = useState<any>(null);
  const [editing, setEditing] = useState<any>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const load = (pg = page) => {
    const p = new URLSearchParams();
    if (status) p.set('status', status);
    p.set('page', String(pg));
    p.set('limit', '20');
    api.get(`/leases?${p}`).then((r) => { setRows(r.data); setMeta(r.meta || null); }).catch((e) => toast.error(e.message));
  };
  useEffect(() => { load(); }, [page]);
  useEffect(() => { setPage(1); }, [status]);
  useEffect(() => {
    api.get('/agents?limit=100').then((r) => setAgents(r.data || [])).catch(() => {});
  }, []);

  const doApprove = async () => {
    setSaving(true);
    try {
      const res = await api.post(`/leases/${toApprove.id}/approve`);
      toast.success(t('ad.lease.approved', { name: res.data.agent_name_ar || '', end: fmtDate(res.data.period_end) }));
      setToApprove(null);
      load();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  const doReject = async () => {
    setSaving(true);
    try {
      await api.post(`/leases/${toReject.id}/reject`, { reason: '' });
      toast.success(t('ad.lease.rejected'));
      setToReject(null);
      load();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  const doCancel = async () => {
    setSaving(true);
    try {
      const reason = toCancel.status === 'paid' ? t('ad.lease.cancelReasonPaid') : t('ad.lease.cancelReasonPending');
      const res = await api.post(`/leases/${toCancel.id}/cancel`, { reason });
      toast.success(toCancel.status === 'paid' ? t('ad.lease.cancelDone', { name: res.data.agent_name_ar || '' }) : t('ad.lease.cancelPendingDone'));
      setToCancel(null);
      load();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  const openCreate = () => {
    setForm({ agent_id: '', amount: '', period_start: '', period_end: '', status: 'paid' });
    setCreating(true);
  };

  const openEdit = (p: any) => {
    setForm({ amount: p.amount, period_start: toDateInput(p.period_start), period_end: toDateInput(p.period_end) });
    setEditing(p);
  };

  const saveCreate = async () => {
    if (!form.agent_id) return toast.error(t('ad.lease.errAgent'));
    if (!form.amount || Number(form.amount) < 0) return toast.error(t('ad.lease.errAmount'));
    if (!form.period_start || !form.period_end) return toast.error(t('ad.lease.errPeriod'));
    setSaving(true);
    try {
      const res = await api.post('/leases', { ...form, amount: Number(form.amount) });
      toast.success(t('ad.lease.created', { paid: form.status === 'paid' ? t('ad.lease.paid') : t('ad.lease.pending'), name: res.data.agent_name_ar || '' }));
      setCreating(false);
      load();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  const saveEdit = async () => {
    if (form.amount === undefined || Number(form.amount) < 0) return toast.error(t('ad.lease.errAmount'));
    if (!form.period_start || !form.period_end) return toast.error(t('ad.lease.errPeriod'));
    setSaving(true);
    try {
      const res = await api.put(`/leases/${editing.id}`, { amount: Number(form.amount), period_start: form.period_start, period_end: form.period_end });
      toast.success(t('ad.lease.edited', { name: res.data.agent_name_ar || '', end: fmtDate(res.data.period_end) }));
      setEditing(null);
      load();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  if (!rows) return <PageLoading />;

  return (
    <div>
      <PageHead title={t('ad.lease.title')} subtitle={t('ad.lease.subtitle')} actions={<><button className="btn btn-primary" onClick={openCreate}>{`+ ${t('ad.lease.manualBtn')}`}</button></>} />

      <div className="filters">
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{t('ad.lease.allStatuses')}</option>
          <option value="pending">{t('ad.lease.pending')}</option>
          <option value="paid">{t('ad.lease.paid')}</option>
          <option value="rejected">{t('ad.lease.rejected')}</option>
          <option value="refunded">{t('ad.lease.refunded')}</option>
        </select>
      </div>

      <div className="card">
        <div className="table-wrap">
          {rows.length === 0 ? <EmptyState text={t('ad.lease.empty')} icon="📜" /> : (
            <table>
              <thead>
                <tr>
                  <th>{t('ad.agent.agent')}</th><th>{t('ad.agent.gov')}</th><th>{t('ad.wallet.amount')}</th><th>{t('ad.lease.periodStart')}</th><th>{t('ad.lease.periodEnd')}</th><th>{t('ad.common.status')}</th><th>{t('ad.lease.paidDate')}</th><th>{t('ad.common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p: any) => (
                  <tr key={p.id}>
                    <td>
                      <div className="bold">{p.agent_name_ar}</div>
                      <div className="muted" style={{ fontSize: 12 }}>{p.agent_email}</div>
                    </td>
                    <td><span className="badge badge-teal">{p.governorate_name_ar}</span></td>
                    <td className="bold">{fmt(p.amount)}</td>
                    <td className="muted">{fmtDate(p.period_start)}</td>
                    <td className="muted">{fmtDate(p.period_end)}</td>
                    <td>
                      {p.status === 'paid' && <span className="badge badge-green">{t('ad.lease.paid')}</span>}
                      {p.status === 'pending' && <span className="badge badge-amber">{t('ad.lease.pending')}</span>}
                      {p.status === 'rejected' && <span className="badge badge-red">{t('ad.lease.rejected')}</span>}
                      {p.status === 'refunded' && <span className="badge badge-gray">{t('ad.lease.refunded')}</span>}
                    </td>
                    <td className="muted">{p.paid_at ? fmtDate(p.paid_at) : '-'}</td>
                    <td>
                      {p.status === 'pending' && (
                        <div className="flex">
                          <button className="btn btn-success btn-sm" onClick={() => setToApprove(p)}>{t('ad.lease.approveBtn')}</button>
                          <button className="btn btn-danger btn-sm" onClick={() => setToReject(p)}>{t('ad.lease.rejectBtn')}</button>
                          <button className="btn btn-outline btn-sm" onClick={() => openEdit(p)}>{t('ad.lease.editBtn')}</button>
                        </div>
                      )}
                      {p.status === 'paid' && (
                        <div className="flex">
                          <button className="btn btn-outline btn-sm" onClick={() => openEdit(p)}>{t('ad.lease.editBtn')}</button>
                          <button className="btn btn-danger btn-sm" onClick={() => setToCancel(p)}>{t('ad.lease.cancelLeaseBtn')}</button>
                        </div>
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

      <Confirm open={!!toApprove} title={t('ad.lease.confirmApproveTitle')} message={t('ad.lease.confirmApproveMsg', { gov: toApprove?.governorate_name_ar, end: fmtDate(toApprove?.period_end), amount: fmt(toApprove?.amount) })} confirmText={t('ad.lease.approveBtn')} onConfirm={doApprove} onCancel={() => setToApprove(null)} />
      <Confirm open={!!toReject} title={t('ad.lease.confirmRejectTitle')} message={t('ad.lease.confirmRejectMsg', { gov: toReject?.governorate_name_ar })} danger confirmText={t('ad.lease.rejectBtn')} onConfirm={doReject} onCancel={() => setToReject(null)} />
      <Confirm
        open={!!toCancel}
        title={toCancel?.status === 'paid' ? t('ad.lease.confirmCancelTitlePaid') : t('ad.lease.confirmCancelTitlePending')}
        message={toCancel?.status === 'paid'
          ? t('ad.lease.confirmCancelMsgPaid', { gov: toCancel?.governorate_name_ar, end: fmtDate(toCancel?.period_end) })
          : t('ad.lease.confirmCancelMsgPending', { gov: toCancel?.governorate_name_ar })}
        danger confirmText={t('ad.lease.yesCancel')} onConfirm={doCancel} onCancel={() => setToCancel(null)}
      />

      <Modal open={creating} title={t('ad.lease.manualModal')} onClose={() => setCreating(false)} size="lg">
        <div className="grid-2">
          <Field label={t('ad.agent.agent')} required>
            <select value={form.agent_id} onChange={(e) => setForm({ ...form, agent_id: e.target.value })}>
              <option value="">{t('ad.lease.selectAgent')}</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>{a.name_ar} — {a.governorate_name_ar}</option>
              ))}
            </select>
          </Field>
          <Field label={t('ad.wallet.amount')} required>
            <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </Field>
          <Field label={t('ad.lease.periodStart')} required>
            <input type="date" value={form.period_start} onChange={(e) => setForm({ ...form, period_start: e.target.value })} />
          </Field>
          <Field label={t('ad.lease.periodEnd')} required>
            <input type="date" value={form.period_end} onChange={(e) => setForm({ ...form, period_end: e.target.value })} />
          </Field>
          <Field label={t('ad.common.status')}>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="paid">{t('ad.lease.paidImmediate')}</option>
              <option value="pending">{t('ad.lease.pendingApproval')}</option>
            </select>
          </Field>
        </div>
        <div className="modal-footer" style={{ marginTop: 16 }}>
          <button className="btn btn-outline" onClick={() => setCreating(false)}>{t('ad.common.cancel')}</button>
          <button className="btn btn-primary" disabled={saving} onClick={saveCreate}>{saving ? t('ad.common.saving') : t('ad.lease.saveBtn')}</button>
        </div>
      </Modal>

      <Modal open={!!editing} title={t('ad.lease.editModal')} onClose={() => setEditing(null)} size="lg">
        <div className="grid-2">
          <Field label={t('ad.wallet.amount')} required>
            <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </Field>
          <Field label={t('ad.lease.periodStart')} required>
            <input type="date" value={form.period_start} onChange={(e) => setForm({ ...form, period_start: e.target.value })} />
          </Field>
          <Field label={t('ad.lease.periodEnd')} required>
            <input type="date" value={form.period_end} onChange={(e) => setForm({ ...form, period_end: e.target.value })} />
          </Field>
        </div>
        <p className="muted" style={{ marginTop: 12 }}>
          {editing?.status === 'paid' ? t('ad.lease.editPaidNote') : t('ad.lease.editPendingNote')}
        </p>
        <div className="modal-footer" style={{ marginTop: 16 }}>
          <button className="btn btn-outline" onClick={() => setEditing(null)}>{t('ad.common.cancel')}</button>
          <button className="btn btn-primary" disabled={saving} onClick={saveEdit}>{saving ? t('ad.common.saving') : t('ad.lease.saveEditBtn')}</button>
        </div>
      </Modal>
    </div>
  );
}
