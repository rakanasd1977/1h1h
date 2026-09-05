import { useEffect, useState } from 'react';
import { api } from '../api';
import { useToast, fmt, PageLoading, EmptyState, Modal, Field, Confirm, Toggle, Pagination } from '@rafidain/shared/ui';
import { PageHead } from '@rafidain/shared/ui';
import { t } from '@rafidain/shared/i18n';
import { useLocale } from '@rafidain/shared';

function itemTitle(r: any) {
  return r.name_ar || r.flight_number || r.name_en || `#${r.id}`;
}
function itemPrice(r: any) {
  return r.price_per_night != null ? r.price_per_night : r.price;
}

export default function CatalogManager() {
  useLocale();
  const KIND_FIELDS: Record<string, { name: string; label: string; type: 'text' | 'number' | 'bool' }[]> = {
    products: [
      { name: 'name_ar', label: t('ad.gov.nameAr'), type: 'text' },
      { name: 'price', label: t('ad.cat.price'), type: 'number' },
      { name: 'old_price', label: t('ad.cat.oldPrice'), type: 'number' },
      { name: 'stock', label: t('ad.cat.stock'), type: 'number' },
      { name: 'is_featured', label: t('ad.cat.featured'), type: 'bool' },
      { name: 'is_active', label: t('ad.cat.available'), type: 'bool' },
    ],
    menu_items: [
      { name: 'name_ar', label: t('ad.gov.nameAr'), type: 'text' },
      { name: 'price', label: t('ad.cat.price'), type: 'number' },
      { name: 'is_featured', label: t('ad.cat.featured'), type: 'bool' },
      { name: 'is_available', label: t('ad.cat.availableNow'), type: 'bool' },
      { name: 'is_active', label: t('ad.cat.active'), type: 'bool' },
    ],
    hotel_rooms: [
      { name: 'name_ar', label: t('ad.gov.nameAr'), type: 'text' },
      { name: 'price_per_night', label: t('ad.cat.pricePerNight'), type: 'number' },
      { name: 'max_guests', label: t('ad.cat.maxGuests'), type: 'number' },
      { name: 'is_featured', label: t('ad.cat.featured'), type: 'bool' },
      { name: 'is_active', label: t('ad.cat.active'), type: 'bool' },
    ],
    flights: [
      { name: 'flight_number', label: t('ad.cat.flightNumber'), type: 'text' },
      { name: 'price', label: t('ad.cat.price'), type: 'number' },
      { name: 'seats', label: t('ad.cat.seats'), type: 'number' },
      { name: 'is_featured', label: t('ad.cat.featured'), type: 'bool' },
      { name: 'is_active', label: t('ad.cat.active'), type: 'bool' },
    ],
    travel_packages: [
      { name: 'name_ar', label: t('ad.gov.nameAr'), type: 'text' },
      { name: 'price', label: t('ad.cat.price'), type: 'number' },
      { name: 'duration_days', label: t('ad.cat.durationDays'), type: 'number' },
      { name: 'is_featured', label: t('ad.cat.featured'), type: 'bool' },
      { name: 'is_active', label: t('ad.cat.active'), type: 'bool' },
    ],
  };

  const [kinds, setKinds] = useState<any[]>([]);
  const [kind, setKind] = useState('products');
  const [providers, setProviders] = useState<any[]>([]);
  const [rows, setRows] = useState<any>(null);
  const [meta, setMeta] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [providerId, setProviderId] = useState('');
  const [active, setActive] = useState('');
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<any>(null);
  const toast = useToast();

  useEffect(() => {
    api.get('/catalog/kinds').then((r) => setKinds(r.data || [])).catch(() => {});
    api.get('/providers?limit=300').then((r) => setProviders((r.data && r.data.rows) || [])).catch(() => {});
  }, []);

  const load = (pg = page) => {
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    if (providerId) p.set('provider_id', providerId);
    if (active) p.set('active', active);
    p.set('kind', kind);
    p.set('page', String(pg));
    p.set('limit', '20');
    api.get(`/catalog?${p}`).then((r) => { setRows(r.data.rows); setMeta(r.data.meta || null); }).catch((e) => toast.error(e.message));
  };
  useEffect(() => { setPage(1); load(1); }, [kind, providerId, active]);
  useEffect(() => { load(); }, [page]);

  const search = () => { setPage(1); load(1); };

  const openEdit = (r: any) => {
    const fields = KIND_FIELDS[kind] || [];
    const f: any = {};
    for (const fld of fields) {
      if (fld.type === 'bool') f[fld.name] = Number(r[fld.name]) ? 1 : 0;
      else f[fld.name] = r[fld.name] ?? '';
    }
    setEditing(r);
    setForm(f);
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload: any = {};
      for (const fld of KIND_FIELDS[kind] || []) {
        const v = form[fld.name];
        if (fld.type === 'bool') payload[fld.name] = v ? 1 : 0;
        else if (fld.type === 'number') payload[fld.name] = v === '' || v == null ? undefined : Number(v);
        else payload[fld.name] = v;
      }
      await api.put(`/catalog/${kind}/${editing.id}`, payload);
      toast.success(t('ad.cat.updated'));
      setEditing(null);
      load();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  const toggle = async (r: any) => {
    try {
      await api.post(`/catalog/${kind}/${r.id}/toggle`);
      toast.success(Number(r.is_active) ? t('ad.cat.deactivated') : t('ad.cat.activated'));
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const doDelete = async () => {
    try {
      const res = await api.del(`/catalog/${kind}/${toDelete.id}`);
      toast.success(res.data.message);
      setToDelete(null);
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const priceMode = kind === 'hotel_rooms' ? 'price_per_night' : 'price';

  return (
    <div>
      <PageHead title={t('ad.cat.title')} subtitle={t('ad.cat.subtitle')} />

      <div className="tabs">
        {(kinds.length ? kinds : [
          { key: 'products', label: t('ad.cat.tabProducts') }, { key: 'menu_items', label: t('ad.cat.tabMenuItems') },
          { key: 'hotel_rooms', label: t('ad.cat.tabRooms') }, { key: 'flights', label: t('ad.cat.tabFlights') }, { key: 'travel_packages', label: t('ad.cat.tabPackages') },
        ]).map((k) => (
          <button key={k.key} className={`tab ${kind === k.key ? 'tab-active' : ''}`} onClick={() => setKind(k.key)}>{k.label}</button>
        ))}
      </div>

      <div className="filters">
        <input placeholder={t('ad.cat.searchPlaceholder')} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} />
        <select value={providerId} onChange={(e) => setProviderId(e.target.value)}>
          <option value="">{t('ad.cat.allProviders')}</option>
          {providers.map((p) => <option key={p.id} value={p.id}>{p.name_ar}</option>)}
        </select>
        <select value={active} onChange={(e) => setActive(e.target.value)}>
          <option value="">{t('ad.cat.allStates')}</option>
          <option value="1">{t('ad.cat.activeOnly')}</option>
          <option value="0">{t('ad.cat.stoppedOnly')}</option>
        </select>
        <button className="btn btn-outline btn-sm" onClick={search}>{t('ad.common.search')}</button>
      </div>

      {!rows ? <PageLoading /> : (
        <div className="card">
          <div className="table-wrap">
            {rows.length === 0 ? <EmptyState text={t('ad.cat.empty')} icon="🛍️" /> : (
              <table>
                <thead>
                  <tr>
                    <th>{t('ad.cat.item')}</th><th>{t('ad.agent.gov')}</th><th>{t('ad.cat.newPrice')}</th><th>{t('ad.cat.discount')}</th><th>{t('ad.cat.featured')}</th><th>{t('ad.cat.available')}</th><th>{t('ad.common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r: any) => (
                    <tr key={r.id}>
                      <td>
                        <div className="bold">{itemTitle(r)}</div>
                        {r.category_name && <div className="muted" style={{ fontSize: 12 }}>{r.category_name}</div>}
                      </td>
                      <td>{r.provider_name}</td>
                      <td className="mono">{fmt(itemPrice(r))}</td>
                      <td className="mono">{r.old_price ? fmt(r.old_price) : '-'}</td>
                      <td>{Number(r.is_featured) ? '⭐' : '-'}</td>
                      <td><Toggle checked={!!Number(r.is_active)} onChange={() => toggle(r)} /></td>
                      <td>
                        <div className="flex">
                          <button className="btn btn-outline btn-sm" onClick={() => openEdit(r)}>{t('ad.common.edit')}</button>
                          <button className="btn btn-danger btn-sm" onClick={() => setToDelete(r)}>{t('ad.common.delete')}</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      <Pagination meta={meta} page={page} onChange={setPage} />

      <Modal open={!!editing} title={`${t('ad.cat.editTitle')}: ${editing ? itemTitle(editing) : ''}`} onClose={() => setEditing(null)}>
        <div className="form-grid">
          {(KIND_FIELDS[kind] || []).map((fld) => (
            <Field key={fld.name} label={fld.label}>
              {fld.type === 'bool' ? (
                <Toggle checked={!!Number(form[fld.name])} onChange={(v: boolean) => setForm({ ...form, [fld.name]: v ? 1 : 0 })} />
              ) : fld.type === 'number' ? (
                <input type="number" value={form[fld.name] ?? ''} onChange={(e) => setForm({ ...form, [fld.name]: e.target.value })} />
              ) : (
                <input value={form[fld.name] ?? ''} onChange={(e) => setForm({ ...form, [fld.name]: e.target.value })} />
              )}
            </Field>
          ))}
        </div>
        <div className="form-actions">
          <button className="btn btn-outline" onClick={() => setEditing(null)}>{t('ad.common.cancel')}</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? t('ad.common.saving') : t('ad.common.save')}</button>
        </div>
      </Modal>

      <Confirm
        open={!!toDelete}
        title={t('ad.cat.deleteTitle')}
        message={t('ad.cat.deleteMsg', { name: toDelete ? itemTitle(toDelete) : '' })}
        danger
        onConfirm={doDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
