import { useEffect, useState } from 'react';
import { api } from '../api';
import { useToast, fmt, fmtDate, PageLoading, EmptyState, Modal, Field, Confirm, Badge, LEASE_STATUS, Toggle, Pagination } from '@rafidain/shared/ui';
import { useStaticLists } from '@rafidain/shared';
import { PageHead } from '@rafidain/shared/ui';
import { t } from '@rafidain/shared/i18n';
import { useLocale } from '@rafidain/shared';

const empty = { name_ar: '', name_en: '', email: '', phone: '', password: '', governorate_id: '', district_name: '', commission_rate: 2 };

export default function Agents() {
  useLocale();
  const [rows, setRows] = useState<any>(null);
  const [meta, setMeta] = useState<any>(null);
  const [page, setPage] = useState(1);
  const { governorates, loading: listsLoading } = useStaticLists(api);
  const [districts, setDistricts] = useState<any>([]);
  const [q, setQ] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(empty);
  const [toDelete, setToDelete] = useState<any>(null);
  const [toRenew, setToRenew] = useState<any>(null);
  const [renewApprove, setRenewApprove] = useState(true);
  const [payments, setPayments] = useState<any>(null);
  const [paymentsAgent, setPaymentsAgent] = useState<any>(null);
  const [resetPw, setResetPw] = useState<any>(null);
  const [newPw, setNewPw] = useState('');
  const [genPw, setGenPw] = useState('');
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const load = (pg = page) => {
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    p.set('page', String(pg));
    p.set('limit', '20');
    api.get(`/agents?${p}`).then((r) => { setRows(r.data); setMeta(r.meta || null); }).catch((e) => toast.error(e.message));
    api.get('/districts').then((r) => setDistricts(r.data || [])).catch(() => {});
  };
  useEffect(() => { load(); }, [page]);

  const search = () => { setPage(1); load(1); };

  const openCreate = () => { setEditing(null); setForm(empty); setModalOpen(true); };
  const openEdit = (a: any) => {
    setEditing(a);
    setForm({ name_ar: a.name_ar, name_en: a.name_en || '', email: a.email, phone: a.phone || '', password: '', governorate_id: a.governorate_id, district_name: a.district_name_ar || '', commission_rate: a.commission_rate });
    setModalOpen(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/agents/${editing.id}`, { ...form, password: undefined });
        toast.success(t('ad.agent.updated'));
      } else {
        const res = await api.post('/agents', form);
        if (res.data.generated_password) {
          setGenPw(res.data.generated_password);
          return;
        }
        toast.success(t('ad.agent.added'));
      }
      setModalOpen(false);
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    try {
      await api.del(`/agents/${toDelete.id}`);
      toast.success(t('ad.agent.deleted'));
      setToDelete(null);
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const doRenew = async () => {
    setSaving(true);
    try {
      const res = await api.post(`/agents/${toRenew.id}/renew-lease`, { approve: renewApprove ? 1 : 0 });
      toast.success(res.data.message);
      setToRenew(null);
      load();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  const viewPayments = async (a: any) => {
    try {
      const res = await api.get(`/agents/${a.id}/lease-payments`);
      setPayments(res.data);
      setPaymentsAgent(a);
    } catch (e: any) { toast.error(e.message); }
  };

  const doReset = async () => {
    if (!newPw || newPw.length < 6) { toast.error(t('ad.agent.pwTooShort')); return; }
    try {
      await api.post('/auth/reset-password', { user_id: resetPw.user_id, new_password: newPw });
      toast.success(t('ad.agent.pwReset'));
      setResetPw(null); setNewPw('');
    } catch (e: any) { toast.error(e.message); }
  };

  if (!rows) return <PageLoading />;

  return (
    <div>
      <PageHead title={t('ad.agent.title')} subtitle={t('ad.agent.subtitle')} actions={<><button className="btn btn-primary" onClick={openCreate}>+ {t('ad.agent.addBtn')}</button></>} />

      <div className="filters">
        <input placeholder={t('ad.agent.searchPlaceholder')} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} />
        <button className="btn btn-outline btn-sm" onClick={search}>{t('ad.common.search')}</button>
      </div>

      <div className="card">
        <div className="table-wrap">
          {rows.length === 0 ? <EmptyState text={t('ad.agent.empty')} icon="🤝" /> : (
            <table>
              <thead>
                <tr>
                  <th>{t('ad.agent.agentName')}</th><th>{t('ad.agent.gov')}</th><th>{t('ad.agent.commission')}</th><th>{t('ad.agent.leaseStatus')}</th>
                  <th>{t('ad.agent.leaseExpires')}</th><th>{t('ad.common.orders')}</th><th>{t('ad.agent.earnings')}</th><th>{t('ad.agent.active')}</th><th>{t('ad.common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a: any) => (
                  <tr key={a.id}>
                    <td>
                      <div className="bold">{a.name_ar}</div>
                      <div className="muted" style={{ fontSize: 12 }}>{a.email}</div>
                    </td>
                    <td>
                      {a.district_name_ar
                        ? <span className="badge badge-teal">{t('ad.agent.district')} {a.district_name_ar}</span>
                        : <span className="badge badge-teal">{a.governorate_name_ar}</span>}
                    </td>
                    <td>%{a.commission_rate}</td>
                    <td><Badge status={a.lease_status} map={LEASE_STATUS} /></td>
                    <td className="muted">{fmtDate(a.lease_expires_at)}</td>
                    <td>{fmt(a.orders_count)}</td>
                    <td>{fmt(a.earnings)}</td>
                    <td><Toggle checked={!!a.user_active} onChange={() => {
                      api.put(`/agents/${a.id}`, { is_active: a.user_active ? 0 : 1 }).then(load).catch((e) => toast.error(e.message));
                    }} /></td>
                    <td>
                      <div className="flex wrap">
                        <button className="btn btn-outline btn-sm" onClick={() => openEdit(a)}>{t('ad.common.edit')}</button>
                        <button className="btn btn-accent btn-sm" onClick={() => { setToRenew(a); setRenewApprove(true); }}>{t('ad.agent.renewLease')}</button>
                        <button className="btn btn-outline btn-sm" onClick={() => viewPayments(a)}>{t('ad.agent.payments')}</button>
                        <button className="btn btn-outline btn-sm" onClick={() => setResetPw(a)}>{t('ad.agent.password')}</button>
                        <button className="btn btn-danger btn-sm" onClick={() => setToDelete(a)}>{t('ad.common.delete')}</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Pagination meta={meta} page={page} onChange={setPage} />

      <Modal open={modalOpen} title={editing ? t('ad.agent.editModal') : t('ad.agent.addModal')} onClose={() => setModalOpen(false)} size="lg">
        <div className="form-grid">
          <Field label={t('ad.gov.nameAr')} required><input value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} /></Field>
          <Field label={t('ad.gov.nameEn')}><input value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} /></Field>
          <Field label={t('ad.agent.email')} required><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label={t('ad.agent.phone')}><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          <Field label={t('ad.agent.gov')} required>
            <select value={form.governorate_id} disabled={listsLoading} onChange={(e) => setForm({ ...form, governorate_id: e.target.value, district_name: '' })}>
              <option value="">{listsLoading ? t('ad.common.loading') : t('ad.agent.chooseGov')}</option>
              {governorates.map((g) => <option key={g.id} value={g.id}>{g.name_ar}</option>)}
            </select>
          </Field>
          <Field label={t('ad.agent.districtField')}>
            <input
              list="district-options"
              placeholder={t('ad.agent.districtPlaceholder')}
              value={form.district_name}
              disabled={listsLoading}
              onChange={(e) => setForm({ ...form, district_name: e.target.value })}
            />
            <datalist id="district-options">
              {districts.filter((d: any) => !form.governorate_id || d.governorate_id === Number(form.governorate_id)).map((d: any) => (
                <option key={d.id} value={d.name_ar}>{d.name_ar} ({d.code})</option>
              ))}
            </datalist>
          </Field>
          <Field label={t('ad.agent.commissionRate')}><input type="number" step="0.5" value={form.commission_rate} onChange={(e) => setForm({ ...form, commission_rate: e.target.value })} /></Field>
          {!editing && (
            <Field label={t('ad.agent.password')} required><input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder={t('ad.agent.pwAutoGenerate')} /></Field>
          )}
        </div>
        {genPw && (
          <div className="alert-success mt-3">{t('ad.agent.addedPwNote')} <strong className="mono">{genPw}</strong></div>
        )}
        <div className="form-actions">
          <button className="btn btn-outline" onClick={() => setModalOpen(false)}>{t('ad.common.cancel')}</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? t('ad.common.saving') : (genPw ? t('ad.agent.saved') : t('ad.common.save'))}
          </button>
        </div>
      </Modal>

      <Modal open={!!toRenew} title={`${t('ad.agent.renewModalTitle')} ${toRenew?.governorate_name_ar || ''}`} onClose={() => setToRenew(null)}>
        <div className="alert-info">{t('ad.agent.renewAnnualFee')}: <strong>{fmt(toRenew?.lease_fee)} {t('ad.currency')}</strong> — {t('ad.agent.renewFeeNote')}.</div>
        <Field label={t('ad.agent.renewMethod')}>
          <select value={renewApprove ? '1' : '0'} onChange={(e) => setRenewApprove(e.target.value === '1')}>
            <option value="1">{t('ad.agent.immediateApprove')}</option>
            <option value="0">{t('ad.agent.sendPendingRequest')}</option>
          </select>
        </Field>
        <div className="form-actions">
          <button className="btn btn-outline" onClick={() => setToRenew(null)}>{t('ad.common.cancel')}</button>
          <button className="btn btn-accent" onClick={doRenew} disabled={saving}>{saving ? t('ad.common.processing') : t('ad.agent.renewLease')}</button>
        </div>
      </Modal>

      <Modal open={!!payments} title={`${t('ad.agent.leasePaymentsTitle')} ${paymentsAgent?.name_ar || ''}`} onClose={() => setPayments(null)}>
        {payments?.length === 0 ? <EmptyState text={t('ad.agent.noPayments')} icon="📜" /> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>#</th><th>{t('ad.agent.amount')}</th><th>{t('ad.agent.periodStart')}</th><th>{t('ad.agent.periodEnd')}</th><th>{t('ad.common.status')}</th></tr>
              </thead>
              <tbody>
                {payments?.map((p: any) => (
                  <tr key={p.id}>
                    <td>{p.id}</td>
                    <td>{fmt(p.amount)}</td>
                    <td className="muted">{fmtDate(p.period_start)}</td>
                    <td className="muted">{fmtDate(p.period_end)}</td>
                    <td><Badge status={p.status} map={{ paid: { label: t('ad.agent.paid'), cls: 'badge-green' }, pending: { label: t('ad.agent.pending'), cls: 'badge-amber' }, rejected: { label: t('ad.agent.rejected'), cls: 'badge-red' } }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      <Modal open={!!resetPw} title={`${t('ad.provider.resetPwTitle')} - ${resetPw?.name_ar || ''}`} onClose={() => setResetPw(null)}>
        <Field label={t('ad.provider.newPw')} required>
          <input type="text" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder={t('ad.provider.pw6chars')} />
        </Field>
        <div className="form-actions">
          <button className="btn btn-outline" onClick={() => setResetPw(null)}>{t('ad.common.cancel')}</button>
          <button className="btn btn-primary" onClick={doReset}>{t('ad.provider.resetPwBtn')}</button>
        </div>
      </Modal>

      <Confirm
        open={!!toDelete}
        title={t('ad.agent.deleteTitle')}
        message={t('ad.agent.deleteMsg', { name: toDelete?.name_ar, gov: toDelete?.governorate_name_ar })}
        danger
        onConfirm={doDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
