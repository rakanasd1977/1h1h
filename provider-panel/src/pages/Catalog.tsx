import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { useToast, fmt, fmtDate, PageLoading, EmptyState, Modal, Confirm, Field, Toggle, Badge, Pagination } from '@rafidain/shared/ui';
import { CATALOGS, ROOM_TYPES } from '../catalog';
import { PromoteModal } from './Promotions';
import { CatalogConfig } from '../types';
import ImageUpload from '../components/ImageUpload';
import { PageHead } from '@rafidain/shared/ui';
import { t } from '@rafidain/shared/i18n';
import { useLocale } from '@rafidain/shared';

function toLocalInput(value: any) {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function initialValue(row: any, field: any) {
  const v = row ? row[field.key] : undefined;
  if (field.type === 'checkbox') return Boolean(v);
  if (field.type === 'images') return (Array.isArray(v) ? v : []).join(', ');
  if (field.type === 'lines') return (Array.isArray(v) ? v : []).join('\n');
  return v === null || v === undefined ? '' : v;
}

function buildPayload(field: any, value: any) {
  if (field.type === 'checkbox') return value ? 1 : 0;
  if (field.type === 'number') return value === '' ? undefined : Number(value);
  if (field.type === 'images') {
    const list = String(value || '').split(',').map((s) => s.trim()).filter(Boolean);
    return list;
  }
  if (field.type === 'lines') {
    const list = String(value || '').split('\n').map((s) => s.trim()).filter(Boolean);
    return list;
  }
  if (field.type === 'select') return value === '' ? null : Number(value);
  return value;
}

function cellValue(row: any, col: any) {
  if (col.route) return `${row.origin_ar || row.origin || ''} ← ${row.destination_ar || row.destination || ''}`.replace(' ←  ← ', '');
  if (col.roomType) return t((ROOM_TYPES as Record<string, any>)[row[col.key]] || row[col.key] || '-');
  if (col.money) return `${fmt(row[col.key])} د.ع`;
  if (col.datetime) return row[col.key] ? fmtDate(row[col.key]) : '-';
  return row[col.key];
}

export default function Catalog({ offersOnly = false }) {
  const [rows, setRows] = useState<any>(null);
  const [meta, setMeta] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [cats, setCats] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [confirmDel, setConfirmDel] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [promoRow, setPromoRow] = useState<any>(null);
  const [net, setNet] = useState<Record<string, any>>({});
  const toast = useToast();
  const { user } = useAuth();
  useLocale();

  const config: CatalogConfig = useMemo(() => (CATALOGS as Record<string, any>)[user.service_type] || CATALOGS.stores, [user]);

  const load = (pg = page) => {
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    if (offersOnly) p.set('offers', '1');
    if (catFilter && config.categoriesApi) p.set('category_id', catFilter);
    p.set('page', String(pg));
    p.set('limit', '20');
    const qs = p.toString();
    api.get(`${config.api}${qs ? '?' + qs : ''}`).then((r) => { setRows(r.data); setMeta(r.meta || null); }).catch((e) => toast.error(e.message));
  };

  const search = () => { setPage(1); load(1); };

  useEffect(() => {
    if (config.categoriesApi) {
      api.get(config.categoriesApi).then((r) => setCats(r.data)).catch(() => setCats([]));
    }
  }, [config]);

  useEffect(() => {
    api.get('/provider/catalog-net').then((r) => setNet(r.data || {})).catch(() => setNet({}));
  }, [config]);

  useEffect(() => { load(); }, [page, offersOnly, catFilter]);
  useEffect(() => { setPage(1); }, [offersOnly, catFilter]);

  const openAdd = () => {
    setEditing({ id: null });
    const init: Record<string, any> = {};
    config.fields.forEach((f) => { init[f.key] = initialValue(null, f); });
    setForm(init);
  };

  const openEdit = (row: any) => {
    setEditing({ id: row.id });
    const init: Record<string, any> = {};
    config.fields.forEach((f) => { init[f.key] = initialValue(row, f); });
    setForm(init);
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload: Record<string, any> = {};
      config.fields.forEach((f) => {
        const v = buildPayload(f, form[f.key]);
        if (v !== undefined) payload[f.key] = v;
      });
      if (editing.id) {
        await api.put(`${config.api}/${editing.id}`, payload);
        toast.success(t('pr.catalog.updatedToast', { item: t(config.item) }));
      } else {
        await api.post(config.api, payload);
        toast.success(t('pr.catalog.addedToast', { item: t(config.item) }));
      }
      setEditing(null);
      load();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  const toggle = async (row: any) => {
    try {
      await api.post(`${config.api}/${row.id}/toggle`);
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const toggleOffer = async (row: any) => {
    try {
      await api.put(`${config.api}/${row.id}`, { is_featured: row.is_featured ? 0 : 1 });
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const toggleAvailable = async (row: any) => {
    try {
      await api.put(`${config.api}/${row.id}`, { is_available: row.is_available ? 0 : 1 });
      toast.success(row.is_available ? t('pr.catalog.toggleAvailableOff') : t('pr.catalog.toggleAvailableOn'));
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const [quick, setQuick] = useState<any>(null);
  const [quickValue, setQuickValue] = useState('');

  const saveQuick = async () => {
    if (!quick) return;
    setSaving(true);
    try {
      await api.put(`${config.api}/${quick.row.id}`, { [quick.field]: Number(quickValue) || 0 });
      toast.success(t('pr.catalog.updatedLabelToast', { label: quick.label }));
      setQuick(null);
      load();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  const del = async () => {
    setSaving(true);
    try {
      await api.del(`${config.api}/${confirmDel.id}`);
      toast.success(t('pr.catalog.deletedToast', { item: t(config.item) }));
      setConfirmDel(null);
      load();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  if (!rows) return <PageLoading />;

  const renderField = (f: any) => {
    if (f.type === 'checkbox') {
      return <Toggle checked={!!form[f.key]} onChange={(v) => set(f.key, v)} />;
    }
    if (f.type === 'textarea') {
      return <textarea value={form[f.key] ?? ''} onChange={(e) => set(f.key, e.target.value)} rows={3} />;
    }
    if (f.type === 'lines') {
      return <textarea value={form[f.key] ?? ''} onChange={(e) => set(f.key, e.target.value)} rows={4} placeholder={f.hint ? t(f.hint) : undefined} />;
    }
    if (f.type === 'images') {
      return <ImageUpload value={form[f.key] ?? ''} onChange={(v) => set(f.key, v)} hint={f.hint ? t(f.hint) : undefined} multiple />;
    }
    if (f.type === 'datetime') {
      return <input type="datetime-local" value={form[f.key] ?? ''} onChange={(e) => set(f.key, e.target.value)} />;
    }
    if (f.type === 'select') {
      const options = f.fromCategories ? cats : f.options ? Object.entries(f.options) : [];
      if (f.fromCategories) {
        return (
          <select value={form[f.key] ?? ''} onChange={(e) => set(f.key, e.target.value)}>
            <option value="">{t('pr.catalog.noCategory')}</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name_ar}</option>)}
          </select>
        );
      }
      return (
        <select value={form[f.key] ?? ''} onChange={(e) => set(f.key, e.target.value)}>
          {options.map(([val, label]) => <option key={val} value={val}>{t(label as string)}</option>)}
        </select>
      );
    }
    if (f.type === 'number') {
      return <input type="number" value={form[f.key] ?? ''} onChange={(e) => set(f.key, e.target.value)} />;
    }
    return <input value={form[f.key] ?? ''} onChange={(e) => set(f.key, e.target.value)} />;
  };

  return (
    <div>
      <PageHead title={offersOnly ? t('pr.catalog.offersPageTitle') : t(config.title)} subtitle={offersOnly ? t('pr.catalog.offersPageSubtitle') : t(config.subtitle)} actions={<><button className="btn btn-primary" onClick={openAdd}>{t('pr.catalog.addBtn', { item: t(config.item) })}</button></>} />

      {offersOnly && (
        <div className="alert-info mb-4">{t('pr.catalog.offersHint')}</div>
      )}

      <div className="filters">
        <input placeholder={t('pr.catalog.searchPlaceholder', { title: t(config.title) })} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} />
        {config.categoriesApi && (
          <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
            <option value="">{t('pr.catalog.allCategories')}</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name_ar}</option>)}
          </select>
        )}
        <button className="btn btn-outline btn-sm" onClick={search}>{t('pr.catalog.searchBtn')}</button>
      </div>

      <div className="card">
        <div className="table-wrap">
          {rows.length === 0 ? <EmptyState text={t('pr.catalog.noItems', { title: t(config.title) })} icon={config.icon} /> : (
            <table>
              <thead>
                <tr>
                  {config.columns.map((c: any) => <th key={c.key}>{t(c.label)}</th>)}
                  <th>{t('pr.catalog.thNetIncome')}</th>
                  <th>{t('pr.catalog.thActions')}</th>
                </tr>
              </thead>
              <tbody>
                 {rows.map((row: any) => (
                   <tr key={row.id}>
                     {config.columns.map((c: any) => (
                      <td key={c.key}>
                        {['is_active', 'is_featured', 'is_available'].includes(c.key)
                          ? <Badge status={row[c.key] ? 'on' : 'off'} map={{ on: { label: c.key === 'is_featured' ? t('pr.catalog.badgeFeatured') : c.key === 'is_available' ? t('pr.catalog.badgeAvailable') : t('pr.catalog.badgeActive'), cls: 'badge-green' }, off: { label: c.key === 'is_available' ? t('pr.catalog.badgeUnavailable') : t('pr.catalog.badgeClosed'), cls: 'badge-gray' } }} />
                          : (c.money ? <span className="bold">{cellValue(row, c)}</span> : cellValue(row, c))}
                      </td>
                    ))}
                    <td className="bold text-success">{fmt(net[row.id] ?? 0)} د.ع</td>
                    <td>
                      <div className="flex gap-sm">
                        <button className="btn btn-primary btn-sm" onClick={() => setPromoRow(row)} title={t('pr.catalog.promoteHint')}>{t('pr.catalog.promoteBtn')}</button>
                        {offersOnly && <button className="btn btn-outline btn-sm" onClick={() => toggleOffer(row)} title={t('pr.catalog.removeOffersHint')}>{t('pr.catalog.removeOffers')}</button>}
                        {user.service_type === 'restaurants' && (
                          <button className={`btn btn-sm ${row.is_available ? 'btn-outline' : 'btn-success'}`} onClick={() => toggleAvailable(row)}>
                            {row.is_available ? t('pr.catalog.availableBadge') : t('pr.catalog.unavailableBadge')}
                          </button>
                        )}
                        {user.service_type === 'stores' && (
                          <button className="btn btn-outline btn-sm" onClick={() => { setQuick({ row, field: 'stock', label: t('pr.catalog.stock') }); setQuickValue(String(row.stock ?? '')); }}>{t('pr.catalog.stock')}</button>
                        )}
                        {user.service_type === 'flights' && (
                          <button className="btn btn-outline btn-sm" onClick={() => { setQuick({ row, field: 'seats', label: t('pr.catalog.seats') }); setQuickValue(String(row.seats ?? '')); }}>{t('pr.catalog.seats')}</button>
                        )}
                        <button className="btn btn-outline btn-sm" onClick={() => openEdit(row)}>{t('pr.catalog.editBtn')}</button>
                        <button className="btn btn-outline btn-sm" onClick={() => toggle(row)}>{row.is_active ? t('pr.catalog.deactivateBtn') : t('pr.catalog.activateBtn')}</button>
                        <button className="btn btn-outline btn-sm btn-danger-ghost" onClick={() => setConfirmDel(row)}>{t('pr.catalog.deleteBtn')}</button>
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

      <Modal open={!!editing} title={editing?.id ? t('pr.catalog.editTitle', { itemF: t(config.itemF), id: editing.id }) : t('pr.catalog.addTitle', { item: t(config.item) })} onClose={() => setEditing(null)} size="lg">
        <div className="grid grid-2">
           {config.fields.map((f: any) => (
            <Field key={f.key} label={t(f.label)} required={f.required} full={f.type === 'textarea' || f.type === 'lines' || f.type === 'images'}>
              {renderField(f)}
            </Field>
          ))}
        </div>
        <div className="flex gap-sm" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="btn btn-outline" onClick={() => setEditing(null)}>{t('pr.catalog.cancel')}</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? t('pr.catalog.saving') : t('pr.catalog.save')}</button>
        </div>
      </Modal>

      <Confirm
        open={!!confirmDel}
        title={t('pr.catalog.deletedTitle', { item: t(config.item) })}
        message={t('pr.catalog.deletedMsg', { name: confirmDel?.name_ar || '' })}
        confirmText={t('pr.catalog.deletedConfirm')}
        danger
        onCancel={() => setConfirmDel(null)}
        onConfirm={del}
      />

      <Modal open={!!quick} title={quick ? t('pr.catalog.quickEditTitle', { label: quick.label, name: quick.row.name_ar || quick.row.flight_number || '' }) : ''} onClose={() => setQuick(null)}>
        <Field label={quick?.label} required>
          <input type="number" min="0" value={quickValue} onChange={(e) => setQuickValue(e.target.value)} />
        </Field>
        <div className="flex gap-sm" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="btn btn-outline" onClick={() => setQuick(null)}>{t('pr.catalog.cancel')}</button>
          <button className="btn btn-primary" onClick={saveQuick} disabled={saving}>{saving ? t('pr.catalog.saving') : t('pr.catalog.save')}</button>
        </div>
      </Modal>

      <PromoteModal open={!!promoRow} onClose={() => setPromoRow(null)} onCreated={() => {}} config={config} preset={promoRow} />
    </div>
  );
}
