import { useEffect, useState } from 'react';
import { api } from '../api';
import { useToast, fmt, PageLoading, EmptyState, Modal, Field, Confirm, Toggle, Pagination } from '@rafidain/shared/ui';
import { useStaticLists } from '@rafidain/shared';
import { PageHead } from '@rafidain/shared/ui';
import { t } from '@rafidain/shared/i18n';
import { useLocale } from '@rafidain/shared';

const empty = { name_ar: '', name_en: '', email: '', phone: '', password: '', governorate_id: '', address: '' };

export default function Customers() {
  useLocale();
  const [rows, setRows] = useState<any>(null);
  const [meta, setMeta] = useState<any>(null);
  const [page, setPage] = useState(1);
  const { governorates, loading: listsLoading } = useStaticLists(api);
  const [q, setQ] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState(empty);
  const [toDelete, setToDelete] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const load = (pg = page) => {
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    p.set('page', String(pg));
    p.set('limit', '20');
    api.get(`/customers?${p}`).then((r) => { setRows(r.data); setMeta(r.meta || null); }).catch((e) => toast.error(e.message));
  };
  useEffect(() => { load(); }, [page]);

  const search = () => { setPage(1); load(1); };

  const openCreate = () => { setEditing(null); setForm(empty); setModalOpen(true); };
  const openEdit = (c: any) => {
    setEditing(c);
    setForm({ name_ar: c.name_ar, name_en: c.name_en || '', email: c.email, phone: c.phone || '', password: '', governorate_id: c.governorate_id || '', address: c.address || '' });
    setModalOpen(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/customers/${editing.id}`, { ...form, password: undefined });
        toast.success(t('ad.cust.updated'));
      } else {
        await api.post('/customers', form);
        toast.success(t('ad.cust.added'));
      }
      setModalOpen(false);
      load();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  const toggle = async (c: any) => {
    try {
      await api.put(`/customers/${c.id}`, { is_active: c.user_active ? 0 : 1 });
      toast.success(c.user_active ? t('ad.cust.deactivated') : t('ad.cust.activated'));
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const doDelete = async () => {
    try {
      const res = await api.del(`/customers/${toDelete.id}`);
      toast.success(res.data.message);
      setToDelete(null);
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  if (!rows) return <PageLoading />;

  return (
    <div>
      <PageHead title={t('ad.cust.title')} subtitle={t('ad.cust.subtitle')} actions={<><button className="btn btn-primary" onClick={openCreate}>+ {t('ad.cust.addBtn')}</button></>} />

      <div className="filters">
        <input placeholder={t('ad.cust.searchPlaceholder')} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} />
        <button className="btn btn-outline btn-sm" onClick={search}>{t('ad.common.search')}</button>
      </div>

      <div className="card">
        <div className="table-wrap">
          {rows.length === 0 ? <EmptyState text={t('ad.cust.empty')} icon="👥" /> : (
            <table>
              <thead>
                <tr>
                  <th>{t('ad.cust.customer')}</th><th>{t('ad.cust.phone')}</th><th>{t('ad.agent.gov')}</th><th>{t('ad.common.orders')}</th><th>{t('ad.cust.totalValue')}</th><th>{t('ad.cust.active')}</th><th>{t('ad.common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c: any) => (
                  <tr key={c.id}>
                    <td>
                      <div className="bold">{c.name_ar}</div>
                      <div className="muted" style={{ fontSize: 12 }}>{c.email}</div>
                    </td>
                    <td className="mono">{c.phone}</td>
                    <td><span className="badge badge-teal">{c.governorate_name_ar || '-'}</span></td>
                    <td>{fmt(c.orders_count)}</td>
                    <td>{fmt(c.total_value)}</td>
                    <td><Toggle checked={!!c.user_active} onChange={() => toggle(c)} /></td>
                    <td>
                      <div className="flex">
                        <button className="btn btn-outline btn-sm" onClick={() => openEdit(c)}>{t('ad.common.edit')}</button>
                        <button className="btn btn-danger btn-sm" onClick={() => setToDelete(c)}>{t('ad.common.delete')}</button>
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

      <Modal open={modalOpen} title={editing ? t('ad.cust.editModal') : t('ad.cust.addModal')} onClose={() => setModalOpen(false)}>
        <div className="form-grid">
          <Field label={t('ad.gov.nameAr')} required><input value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} /></Field>
          <Field label={t('ad.gov.nameEn')}><input value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} /></Field>
          <Field label={t('ad.agent.email')} required><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label={t('ad.cust.phone')} required><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          <Field label={t('ad.agent.gov')}>
            <select value={form.governorate_id} disabled={listsLoading} onChange={(e) => setForm({ ...form, governorate_id: e.target.value })}>
              <option value="">{listsLoading ? t('ad.common.loading') : t('ad.cust.noGovernorate')}</option>
              {governorates.map((g) => <option key={g.id} value={g.id}>{g.name_ar}</option>)}
            </select>
          </Field>
          <Field label={t('ad.provider.address')}><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
          {!editing && <Field label={t('ad.agent.password')} required><input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>}
        </div>
        <div className="form-actions">
          <button className="btn btn-outline" onClick={() => setModalOpen(false)}>{t('ad.common.cancel')}</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? t('ad.common.saving') : t('ad.common.save')}</button>
        </div>
      </Modal>

      <Confirm open={!!toDelete} title={t('ad.cust.deleteTitle')} message={t('ad.cust.deleteMsg', { name: toDelete?.name_ar })} danger onConfirm={doDelete} onCancel={() => setToDelete(null)} />
    </div>
  );
}
