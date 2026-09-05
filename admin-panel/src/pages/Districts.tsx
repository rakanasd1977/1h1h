import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useToast, fmt, PageLoading, EmptyState, Modal, Field, Confirm, Toggle, Badge, LEASE_STATUS } from '@rafidain/shared/ui';
import { PageHead } from '@rafidain/shared/ui';
import { t } from '@rafidain/shared/i18n';
import { useLocale } from '@rafidain/shared';

const empty = { name_ar: '', name_en: '', code: '', governorate_id: '', lease_fee: 0, sort_order: 0, lat: '', lng: '' };

export default function Districts() {
  useLocale();
  const [rows, setRows] = useState<any>(null);
  const [governorates, setGovernorates] = useState<any>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(empty);
  const [toDelete, setToDelete] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();

  const load = () => {
    api.get('/districts').then((r) => setRows(r.data)).catch((e) => toast.error(e.message));
    api.get('/governorates').then((r) => setGovernorates(r.data)).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm(empty); setModalOpen(true); };
  const openEdit = (d: any) => {
    setEditing(d);
    setForm({
      name_ar: d.name_ar, name_en: d.name_en, code: d.code, governorate_id: d.governorate_id,
      lease_fee: d.lease_fee, sort_order: d.sort_order, lat: d.lat ?? '', lng: d.lng ?? '',
    });
    setModalOpen(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/districts/${editing.id}`, form);
        toast.success(t('ad.dist.updated'));
      } else {
        await api.post('/districts', form);
        toast.success(t('ad.dist.added'));
      }
      setModalOpen(false);
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (d: any) => {
    try {
      await api.post(`/districts/${d.id}/toggle`);
      toast.success(d.is_active ? t('ad.dist.deactivated') : t('ad.dist.activated'));
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const doDelete = async () => {
    try {
      await api.del(`/districts/${toDelete.id}`);
      toast.success(t('ad.dist.deleted'));
      setToDelete(null);
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  if (!rows) return <PageLoading />;

  return (
    <div>
      <PageHead title={t('ad.dist.title')} subtitle={t('ad.dist.subtitle')} actions={<><button className="btn btn-primary" onClick={openCreate}>+ {t('ad.dist.addBtn')}</button></>} />

      <div className="card">
        <div className="table-wrap">
          {rows.length === 0 ? <EmptyState text={t('ad.dist.empty')} /> : (
            <table>
              <thead>
                <tr>
                  <th>#</th><th>{t('ad.dist.distName')}</th><th>{t('ad.gov.code')}</th><th>{t('ad.dist.parentGov')}</th>
                  <th>{t('ad.gov.leaseFee')}</th><th>{t('ad.common.status')}</th><th>{t('ad.dist.distAgent')}</th><th>{t('ad.common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((d: any, i: any) => (
                  <tr key={d.id}>
                    <td className="muted">{i + 1}</td>
                    <td><span className="bold">{d.name_ar}</span> <span className="muted">({d.name_en})</span></td>
                    <td><span className="mono">{d.code}</span></td>
                    <td>{d.governorate_name_ar}</td>
                    <td>{fmt(d.lease_fee)}</td>
                    <td><Toggle checked={!!d.is_active} onChange={() => toggleActive(d)} /></td>
                    <td>
                      {d.agent ? (
                        <div className="flex" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <div>
                            <button className="link-btn" onClick={() => navigate('/agents')} title={t('ad.gov.manageAgents')}>{d.agent.agent_name}</button>
                            <div className="muted" style={{ fontSize: 12 }}>{d.agent.agent_email}</div>
                          </div>
                          <Badge status={d.agent.lease_status} map={LEASE_STATUS} />
                          {!d.agent.agent_active && <Badge status="deactivated" map={{ deactivated: { label: t('ad.common.suspended'), cls: 'badge-red' } }} />}
                        </div>
                      ) : (
                        <span className="muted">{t('ad.gov.noAgent')}</span>
                      )}
                      <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                        <button className="link-btn" onClick={() => navigate('/agents')}>{t('ad.gov.manageAgents')} ←</button>
                      </div>
                    </td>
                    <td>
                      <div className="flex">
                        <button className="btn btn-outline btn-sm" onClick={() => openEdit(d)}>{t('ad.common.edit')}</button>
                        <button className="btn btn-danger btn-sm" onClick={() => setToDelete(d)}>{t('ad.common.delete')}</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Modal open={modalOpen} title={editing ? t('ad.dist.editModal') : t('ad.dist.addModal')} onClose={() => setModalOpen(false)}>
        <div className="form-grid">
          <Field label={t('ad.dist.nameAr')} required><input value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} /></Field>
          <Field label={t('ad.dist.nameEn')} required><input value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} /></Field>
          <Field label={t('ad.gov.code')} required><input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="مثال: RUS" /></Field>
          <Field label={t('ad.dist.parentGov')} required>
            <select value={form.governorate_id} onChange={(e) => setForm({ ...form, governorate_id: e.target.value })}>
              <option value="">{t('ad.dist.chooseGov')}</option>
              {governorates.map((g: any) => <option key={g.id} value={g.id}>{g.name_ar}</option>)}
            </select>
          </Field>
          <Field label={t('ad.gov.leaseFee')}><input type="number" value={form.lease_fee} onChange={(e) => setForm({ ...form, lease_fee: e.target.value })} /></Field>
          <Field label={t('ad.gov.sortOrder')}><input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} /></Field>
          <Field label="lat"><input type="number" step="0.0001" value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} /></Field>
          <Field label="lng"><input type="number" step="0.0001" value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })} /></Field>
        </div>
        <div className="form-actions">
          <button className="btn btn-outline" onClick={() => setModalOpen(false)}>{t('ad.common.cancel')}</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? t('ad.common.saving') : t('ad.common.save')}</button>
        </div>
      </Modal>

      <Confirm
        open={!!toDelete}
        title={t('ad.dist.deleteTitle')}
        message={t('ad.dist.deleteMsg', { name: toDelete?.name_ar })}
        danger
        onConfirm={doDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
