import { useEffect, useState } from 'react';
import { api } from '../api';
import { useToast, fmt, PageLoading, EmptyState, Modal, Field, Confirm, Toggle } from '@rafidain/shared/ui';
import { PageHead } from '@rafidain/shared/ui';
import { t } from '@rafidain/shared/i18n';
import { useLocale } from '@rafidain/shared';

const empty = { slug: '', name_ar: '', name_en: '', description: '', icon: '', sort_order: 0, commission_rate: '' };

export default function Services() {
  useLocale();
  const [rows, setRows] = useState<any>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(empty);
  const [toDelete, setToDelete] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const load = () => api.get('/services').then((r) => setRows(r.data)).catch((e) => toast.error(e.message));
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm(empty); setModalOpen(true); };
  const openEdit = (s: any) => { setEditing(s); setForm({ slug: s.slug, name_ar: s.name_ar, name_en: s.name_en, description: s.description || '', icon: s.icon || '', sort_order: s.sort_order, commission_rate: s.commission_rate ?? '' }); setModalOpen(true); };

  const save = async () => {
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/services/${editing.id}`, form);
        toast.success(t('ad.svc.updated'));
      } else {
        await api.post('/services', form);
        toast.success(t('ad.svc.added'));
      }
      setModalOpen(false);
      load();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  const toggle = async (s: any) => {
    try {
      await api.post(`/services/${s.id}/toggle`);
      toast.success(s.is_active ? t('ad.svc.deactivated') : t('ad.svc.activated'));
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const doDelete = async () => {
    try {
      await api.del(`/services/${toDelete.id}`);
      toast.success(t('ad.svc.deleted'));
      setToDelete(null);
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  if (!rows) return <PageLoading />;

  return (
    <div>
      <PageHead title={t('ad.svc.title')} subtitle={t('ad.svc.subtitle')} actions={<><button className="btn btn-primary" onClick={openCreate}>+ {t('ad.svc.addBtn')}</button></>} />

      <div className="card">
        <div className="table-wrap">
          {rows.length === 0 ? <EmptyState text={t('ad.svc.empty')} /> : (
            <table>
              <thead>
                <tr><th>{t('ad.svc.service')}</th><th>{t('ad.gov.code')}</th><th>{t('ad.common.description')}</th><th>{t('ad.svc.providerCount')}</th><th>{t('ad.svc.commissionRate')}</th><th>{t('ad.common.status')}</th><th>{t('ad.common.actions')}</th></tr>
              </thead>
              <tbody>
                {rows.map((s: any) => (
                  <tr key={s.id}>
                    <td>
                      <div className="flex">
                        <span style={{ fontSize: 22 }}>{s.icon}</span>
                        <div>
                          <div className="bold">{s.name_ar}</div>
                          <div className="muted" style={{ fontSize: 12 }}>{s.name_en}</div>
                        </div>
                      </div>
                    </td>
                    <td><span className="mono">{s.slug}</span></td>
                    <td className="muted">{s.description}</td>
                    <td><span className="badge badge-teal">{fmt(s.providers_count)}</span></td>
                    <td>{s.commission_rate != null ? <span className="badge badge-amber">{s.commission_rate}%</span> : <span className="muted">{t('ad.svc.default')}</span>}</td>
                    <td><Toggle checked={!!s.is_active} onChange={() => toggle(s)} /></td>
                    <td>
                      <div className="flex">
                        <button className="btn btn-outline btn-sm" onClick={() => openEdit(s)}>{t('ad.common.edit')}</button>
                        <button className="btn btn-danger btn-sm" onClick={() => setToDelete(s)}>{t('ad.common.delete')}</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Modal open={modalOpen} title={editing ? t('ad.svc.editModal') : t('ad.svc.addModal')} onClose={() => setModalOpen(false)}>
        <div className="form-grid">
          <Field label={t('ad.gov.nameAr')} required><input value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} /></Field>
          <Field label={t('ad.gov.nameEn')} required><input value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} /></Field>
          <Field label="slug" required><input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="مثال: stores" /></Field>
          <Field label={t('ad.svc.icon')}><input value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} placeholder="مثال: 🏪" /></Field>
          <Field label={t('ad.common.description')}><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <Field label={t('ad.gov.sortOrder')}><input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} /></Field>
          <Field label={t('ad.svc.commissionRateField')} hint={t('ad.svc.commissionHint')}><input type="number" step="0.5" min="0" max="100" value={form.commission_rate} onChange={(e) => setForm({ ...form, commission_rate: e.target.value })} placeholder="5" /></Field>
        </div>
        <div className="form-actions">
          <button className="btn btn-outline" onClick={() => setModalOpen(false)}>{t('ad.common.cancel')}</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? t('ad.common.saving') : t('ad.common.save')}</button>
        </div>
      </Modal>

      <Confirm open={!!toDelete} title={t('ad.svc.deleteTitle')} message={t('ad.svc.deleteMsg', { name: toDelete?.name_ar })} danger onConfirm={doDelete} onCancel={() => setToDelete(null)} />
    </div>
  );
}
