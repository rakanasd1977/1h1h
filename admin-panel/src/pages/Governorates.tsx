import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useToast, fmt, PageLoading, EmptyState, Modal, Field, Confirm, Toggle, Badge, LEASE_STATUS } from '@rafidain/shared/ui';
import { PageHead } from '@rafidain/shared/ui';
import { t } from '@rafidain/shared/i18n';
import { useLocale } from '@rafidain/shared';

const empty = { name_ar: '', name_en: '', code: '', lease_fee: 0, sort_order: 0 };

export default function Governorates() {
  useLocale();
  const [rows, setRows] = useState<any>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(empty);
  const [toDelete, setToDelete] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();

  const load = () => api.get('/governorates').then((r) => setRows(r.data)).catch((e) => toast.error(e.message));
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm(empty); setModalOpen(true); };
  const openEdit = (g: any) => { setEditing(g); setForm({ name_ar: g.name_ar, name_en: g.name_en, code: g.code, lease_fee: g.lease_fee, sort_order: g.sort_order }); setModalOpen(true); };

  const save = async () => {
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/governorates/${editing.id}`, form);
        toast.success(t('ad.gov.updated'));
      } else {
        await api.post('/governorates', form);
        toast.success(t('ad.gov.added'));
      }
      setModalOpen(false);
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (g: any) => {
    try {
      await api.post(`/governorates/${g.id}/toggle`);
      toast.success(g.is_active ? t('ad.gov.deactivated') : t('ad.gov.activated'));
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const doDelete = async () => {
    try {
      await api.del(`/governorates/${toDelete.id}`);
      toast.success(t('ad.gov.deleted'));
      setToDelete(null);
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  if (!rows) return <PageLoading />;

  return (
    <div>
      <PageHead title={t('ad.gov.title')} subtitle={t('ad.gov.subtitle')} actions={<><button className="btn btn-primary" onClick={openCreate}>+ {t('ad.gov.addBtn')}</button></>} />

      <div className="card">
        <div className="table-wrap">
          {rows.length === 0 ? <EmptyState text={t('ad.gov.empty')} /> : (
            <table>
              <thead>
                <tr>
                  <th>#</th><th>{t('ad.gov.govName')}</th><th>{t('ad.gov.code')}</th><th>{t('ad.gov.leaseFee')}</th>
                  <th>{t('ad.common.status')}</th><th>{t('ad.gov.assignedAgent')}</th><th>{t('ad.gov.providers')}</th><th>{t('ad.common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((g: any, i: any) => (
                  <tr key={g.id}>
                    <td className="muted">{i + 1}</td>
                    <td><span className="bold">{g.name_ar}</span> <span className="muted">({g.name_en})</span></td>
                    <td><span className="mono">{g.code}</span></td>
                    <td>{fmt(g.lease_fee)}</td>
                    <td><Toggle checked={!!g.is_active} onChange={() => toggleActive(g)} /></td>
                    <td>
                      {g.agent ? (
                        <div className="flex" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <div>
                            <button
                              className="link-btn"
                              onClick={() => navigate('/agents')}
                              title={t('ad.gov.manageAgents')}
                            >{g.agent.agent_name}</button>
                            <div className="muted" style={{ fontSize: 12 }}>{g.agent.agent_email}</div>
                          </div>
                          <Badge status={g.agent.lease_status} map={LEASE_STATUS} />
                          {!g.agent.agent_active && <Badge status="deactivated" map={{ deactivated: { label: t('ad.common.suspended'), cls: 'badge-red' } }} />}
                        </div>
                      ) : (
                        <span className="muted">{t('ad.gov.noAgent')}</span>
                      )}
                      <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                        <button className="link-btn" onClick={() => navigate('/agents')}>{t('ad.gov.manageAgents')} ←</button>
                      </div>
                    </td>
                    <td>{fmt(g.providers_count ?? 0)}</td>
                    <td>
                      <div className="flex">
                        <button className="btn btn-outline btn-sm" onClick={() => openEdit(g)}>{t('ad.common.edit')}</button>
                        <button className="btn btn-danger btn-sm" onClick={() => setToDelete(g)}>{t('ad.common.delete')}</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Modal open={modalOpen} title={editing ? t('ad.gov.editModal') : t('ad.gov.addModal')} onClose={() => setModalOpen(false)}>
        <div className="form-grid">
          <Field label={t('ad.gov.nameAr')} required><input value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} /></Field>
          <Field label={t('ad.gov.nameEn')} required><input value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} /></Field>
          <Field label={t('ad.gov.code')} required><input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="مثال: BAG" /></Field>
          <Field label={t('ad.gov.leaseFee')}><input type="number" value={form.lease_fee} onChange={(e) => setForm({ ...form, lease_fee: e.target.value })} /></Field>
          <Field label={t('ad.gov.sortOrder')}><input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} /></Field>
        </div>
        <div className="form-actions">
          <button className="btn btn-outline" onClick={() => setModalOpen(false)}>{t('ad.common.cancel')}</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? t('ad.common.saving') : t('ad.common.save')}</button>
        </div>
      </Modal>

      <Confirm
        open={!!toDelete}
        title={t('ad.gov.deleteTitle')}
        message={t('ad.gov.deleteMsg', { name: toDelete?.name_ar })}
        danger
        onConfirm={doDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
