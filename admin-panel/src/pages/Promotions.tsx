import { useEffect, useState } from 'react';
import { api, downloadFile } from '../api';
import { useToast, fmt, fmtDate, PageLoading, EmptyState, Confirm, Badge, Modal, Field, Pagination, StatCard } from '@rafidain/shared/ui';
import { useStaticLists } from '@rafidain/shared';
import { PageHead } from '@rafidain/shared/ui';
import { t } from '@rafidain/shared/i18n';
import { useLocale } from '@rafidain/shared';

const SERVICE_ITEM_TYPES = {
  stores: 'products',
  restaurants: 'menu_items',
  hotels: 'hotel_rooms',
  flights: 'flights',
  travel_offices: 'travel_packages',
};

function remainingDays(row: any) {
  if (!row.ends_at) return null;
  const d = new Date(row.ends_at.replace(' ', 'T') + 'Z');
  return Math.max(0, Math.ceil((d.getTime() - Date.now()) / 86400000));
}

export function AdPreviewModal({ open, row, onClose }: { open: any; row: any; onClose: any }) {
  useLocale();
  const LINK_LABELS = {
    products: t('ad.promo.linkProducts'),
    menu_items: t('ad.promo.linkMenuItems'),
    hotel_rooms: t('ad.promo.linkRooms'),
    flights: t('ad.promo.linkFlights'),
    travel_packages: t('ad.promo.linkPackages'),
  };
  if (!open || !row) return null;
  const days = remainingDays(row);
  return (
    <Modal open title={t('ad.promo.previewTitle')} onClose={onClose} size="sm">
      <div className="alert-info mb-4">
        {t('ad.promo.previewNote', { gov: row.governorate_name_ar })}
      </div>
      <div className="ad-preview">
        {row.item_image ? (
          <img src={row.item_image} alt={row.item_title} className="ad-preview__img" />
        ) : (
          <div className="ad-preview__img ad-preview__img--placeholder">{row.service_icon || '📢'}</div>
        )}
        <div className="ad-preview__body">
          <span className="ad-preview__badge">{t('ad.promo.adBadge')}</span>
          <div className="ad-preview__title">{row.item_title}</div>
          <div className="ad-preview__sub">{row.provider_name} · {row.service_name_ar}</div>
          <div className="ad-preview__price">{fmt(row.item_price)} {t('ad.currency')}</div>
        </div>
      </div>
      <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>
        {t('ad.promo.clickGoesTo', { link: (LINK_LABELS as any)[row.item_type] || t('ad.promo.linkItem') })}{' '}
        {days !== null ? t('ad.promo.remainingDays', { days: String(days) }) : t('ad.promo.openEnded')}
      </div>
      <div className="flex gap-sm" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
        <button className="btn btn-primary" onClick={onClose}>{t('ad.common.close')}</button>
      </div>
    </Modal>
  );
}

export function CreateAdModal({ open, onClose, governorates, settings, onCreated }: { open: any; onClose: any; governorates: any; settings: any; onCreated: any }) {
  useLocale();
  const toast = useToast();
  const ITEM_TYPE_LABELS = {
    products: t('ad.promo.itemTypeProduct'),
    menu_items: t('ad.promo.itemTypeMenuItem'),
    hotel_rooms: t('ad.promo.itemTypeRoom'),
    flights: t('ad.promo.itemTypeFlight'),
    travel_packages: t('ad.promo.itemTypePackage'),
  };
  const [providers, setProviders] = useState<any[]>([]);
  const [balances, setBalances] = useState<Record<number, number>>({});
  const [form, setForm] = useState({ provider_id: '', item_id: '', duration_days: settings?.duration_days || 7, target: 'governorate', governorate_ids: [] as number[], billing: 'wallet', placement: 'home_top' });
  const [items, setItems] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({ provider_id: '', item_id: '', duration_days: settings?.duration_days || 7, target: 'governorate', governorate_ids: [] as number[], billing: 'wallet', placement: 'home_top' });
    setItems(null);
    setBalances({});
    api.get('/providers?limit=100').then((r) => setProviders(r.data || [])).catch(() => {});
    api.get('/wallets?limit=200').then((r) => {
      const map: Record<number, number> = {};
      (r.data || []).forEach((w: any) => { map[Number(w.provider_id)] = Number(w.balance) || 0; });
      setBalances(map);
    }).catch(() => {});
  }, [open]);

  const provider = providers.find((p) => Number(p.id) === Number(form.provider_id));
  const itemType = provider ? (SERVICE_ITEM_TYPES as any)[provider.service_slug] : null;

  useEffect(() => {
    if (!form.provider_id || !itemType) { setItems(null); return; }
    let alive = true;
    setItems(null);
    api.get(`/promotions/admin/items?provider_id=${form.provider_id}&item_type=${itemType}`)
      .then((r) => { if (alive) setItems(r.data || []); })
      .catch((e) => { if (alive) { setItems([]); toast.error(e.message); } });
    return () => { alive = false; };
  }, [form.provider_id, itemType]);

  const selectProvider = (id: any) => {
    const p = providers.find((x) => Number(x.id) === Number(id));
    setForm((f) => ({
      ...f,
      provider_id: id,
      item_id: '',
      governorate_ids: p ? [Number(p.governorate_id)] : f.governorate_ids,
    }));
  };

  const toggleGov = (id: any) => {
    const n = Number(id);
    setForm((f) => ({
      ...f,
      governorate_ids: f.governorate_ids.includes(n)
        ? f.governorate_ids.filter((x) => x !== n)
        : [...f.governorate_ids, n],
    }));
  };

  const unitCost = (() => {
    const price = Number(settings?.price) || 5000;
    const base = Math.max(1, Number(settings?.duration_days) || 7);
    const days = Math.max(1, Number(form.duration_days) || base);
    return (price / base) * days;
  })();
  const count = form.target === 'all' ? governorates.length : form.governorate_ids.length;
  const cost = form.billing === 'wallet' ? unitCost * count : 0;
  const balance = Number(balances[Number(form.provider_id)]) || 0;
  const insufficient = form.billing === 'wallet' && form.provider_id && balance < cost;

  const submit = async () => {
    if (!form.provider_id) return toast.error(t('ad.promo.errProvider'));
    if (!form.item_id) return toast.error(t('ad.promo.errItem'));
    const days = Number(form.duration_days);
    if (!days || days < 1 || days > 90) return toast.error(t('ad.promo.errDuration'));
    if (form.target === 'governorate' && form.governorate_ids.length === 0) return toast.error(t('ad.promo.errGovernorate'));
    if (insufficient) return toast.error(t('ad.promo.errInsufficient', { balance: fmt(balance) }));
    setSaving(true);
    try {
      const res =       await api.post('/promotions/admin/create', {
        provider_id: Number(form.provider_id),
        item_type: itemType,
        item_id: Number(form.item_id),
        duration_days: days,
        target: form.target,
        governorate_ids: form.governorate_ids,
        billing: form.billing,
        placement: form.placement,
      });
      toast.success(t('ad.promo.created', { item: res.data.item_title }));
      onCreated(res.data);
      onClose();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  return (
    <Modal open={open} title={t('ad.promo.createTitle')} onClose={onClose} size="lg">
      <div className="form-grid">
        <Field label={t('ad.provider.provider')} required>
          <select value={form.provider_id} onChange={(e) => selectProvider(e.target.value)}>
            <option value="">— {t('ad.promo.chooseProvider')} —</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name_ar} · {p.service_name_ar} · {p.governorate_name_ar}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('ad.promo.item')} required hint={itemType ? `${t('ad.promo.serviceType')}: ${(ITEM_TYPE_LABELS as any)[itemType] || itemType}` : t('ad.promo.chooseProviderFirst')}>
          <select value={form.item_id} onChange={(e) => setForm({ ...form, item_id: e.target.value })} disabled={!provider}>
            <option value="">{items === null ? t('ad.common.loading') : (items && items.length ? t('ad.promo.chooseItem') : t('ad.promo.noItems'))}</option>
            {(items || []).map((it: any) => <option key={it.id} value={it.id}>{it.title} · {fmt(it.price)} {t('ad.currency')}</option>)}
          </select>
        </Field>
        <Field label={t('ad.promo.duration')} required hint={t('ad.promo.durationHint')}>
          <input type="number" min="1" max="90" value={form.duration_days} onChange={(e) => setForm({ ...form, duration_days: e.target.value })} />
        </Field>
        <Field label={t('ad.promo.billing')} hint={t('ad.promo.billingHint')}>
          <select value={form.billing} onChange={(e) => setForm({ ...form, billing: e.target.value })}>
            <option value="wallet">{t('ad.promo.billingWallet')}</option>
            <option value="free">{t('ad.promo.billingFree')}</option>
          </select>
        </Field>
        <Field label={t('ad.promo.placement')} hint={t('ad.promo.placementHint')}>
          <select value={form.placement} onChange={(e) => setForm({ ...form, placement: e.target.value })}>
            <option value="home_top">{t('ad.promo.placementHomeTop')}</option>
            <option value="most_ordered">{t('ad.promo.placementMostOrdered')}</option>
          </select>
        </Field>
      </div>

      <Field label={t('ad.promo.targetScope')} required full>
        <div className="flex gap-sm" style={{ gap: 16 }}>
          <label className="flex" style={{ gap: 6, alignItems: 'center', fontWeight: 600, fontSize: 13 }}>
            <input type="radio" checked={form.target === 'governorate'} onChange={() => setForm({ ...form, target: 'governorate' })} />
            {t('ad.promo.specificGovernorates', { count: String(form.governorate_ids.length) })}
          </label>
          <label className="flex" style={{ gap: 6, alignItems: 'center', fontWeight: 600, fontSize: 13 }}>
            <input type="radio" checked={form.target === 'all'} onChange={() => setForm({ ...form, target: 'all' })} />
            {t('ad.promo.allGovernorates', { count: String(governorates.length) })}
          </label>
        </div>
      </Field>

      {form.target === 'governorate' && (
        <div className="card" style={{ marginTop: 4, padding: 12 }}>
          <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
            {t('ad.promo.govSelectNote')}
          </div>
          <div style={{ maxHeight: 190, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px 10px' }}>
            {governorates.map((g: any) => (
              <label key={g.id} className="flex" style={{ gap: 6, alignItems: 'center', fontSize: 13 }}>
                <input type="checkbox" checked={form.governorate_ids.includes(Number(g.id))} onChange={() => toggleGov(g.id)} />
                {g.name_ar}
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="alert-info mt-4" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div className="bold">{t('ad.promo.estimatedCost')}: {fmt(Math.round(cost))} {t('ad.currency')}</div>
          <div className="muted" style={{ fontSize: 12 }}>
            {form.billing === 'wallet'
              ? t('ad.promo.costBreakdown', { unit: fmt(unitCost), count: String(count), balance: fmt(balance) })
              : t('ad.promo.freeNote')}
            {insufficient && <span className="text-danger"> — {t('ad.promo.insufficientBalance')}</span>}
          </div>
        </div>
        <span className="badge badge-primary">{form.target === 'all' ? t('ad.promo.allGovernoratesShort') : t('ad.promo.govCount', { count: String(form.governorate_ids.length) })}</span>
      </div>

      <div className="form-actions">
        <button className="btn btn-outline" onClick={onClose}>{t('ad.common.cancel')}</button>
        <button className="btn btn-primary" onClick={submit} disabled={saving}>{saving ? t('ad.common.creating') : t('ad.promo.createBtn')}</button>
      </div>
    </Modal>
  );
}

export default function Promotions() {
  useLocale();
  const PROMO_STATUS = {
    active: { label: t('ad.promo.statusActive'), cls: 'badge-green' },
    ended: { label: t('ad.promo.statusEnded'), cls: 'badge-gray' },
  };
  const PLACEMENT_LABELS: Record<string, string> = {
    home_top: t('ad.promo.placementTop'),
    most_ordered: t('ad.promo.placementMostOrderedLabel'),
  };
  const LINK_LABELS = {
    products: t('ad.promo.linkProducts'),
    menu_items: t('ad.promo.linkMenuItems'),
    hotel_rooms: t('ad.promo.linkRooms'),
    flights: t('ad.promo.linkFlights'),
    travel_packages: t('ad.promo.linkPackages'),
  };
  const toast = useToast();
  const [rows, setRows] = useState<any>(null);
  const [meta, setMeta] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [placement, setPlacement] = useState('');
  const [governorateId, setGovernorateId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [q, setQ] = useState('');
  const [qApplied, setQApplied] = useState('');
  const { governorates, services, loading: listsLoading } = useStaticLists(api);
  const [previewTarget, setPreviewTarget] = useState<any>(null);
  const [endTarget, setEndTarget] = useState<any>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const load = (pg = page) => {
    const p = new URLSearchParams();
    if (status) p.set('status', status);
    if (placement) p.set('placement', placement);
    if (governorateId) p.set('governorate_id', governorateId);
    if (serviceId) p.set('service_id', serviceId);
    if (qApplied) p.set('q', qApplied);
    p.set('page', String(pg));
    p.set('limit', '20');
    api.get(`/promotions/all?${p}`).then((r) => {
      setRows(r.data);
      setMeta(r.meta || null);
    }).catch((e) => toast.error(e.message));
  };

  useEffect(() => { load(); }, [page, status, placement, governorateId, serviceId, qApplied]);
  useEffect(() => { setPage(1); }, [status, placement, governorateId, serviceId, qApplied]);

  const submitSearch = () => setQApplied(q.trim());

  const exportCsv = async () => {
    const p = new URLSearchParams();
    if (status) p.set('status', status);
    if (governorateId) p.set('governorate_id', governorateId);
    if (serviceId) p.set('service_id', serviceId);
    if (qApplied) p.set('q', qApplied);
    try {
      await downloadFile(`/api/promotions/all/export?${p}`, `promotions-${Date.now()}.csv`);
      toast.success(t('ad.promo.exported'));
    } catch (e: any) {
      toast.error(e.message || t('ad.promo.exportFailed'));
    }
  };

  const end = async () => {
    try {
      await api.del(`/promotions/${endTarget.id}`);
      toast.success(t('ad.promo.stopped', { item: endTarget.item_title }));
      setEndTarget(null);
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  if (!rows) return <PageLoading />;

  const s = meta?.settings || {};
  const costPerDay = s.duration_days ? Math.round(s.price / s.duration_days) : s.price;

  return (
    <div>
<PageHead title={t('ad.promo.title')} subtitle={t('ad.promo.subtitle')} actions={<><div className="flex" style={{ gap: 8 }}>
          <button className="btn btn-primary" onClick={() => setCreateOpen(true)}>＋ {t('ad.promo.createBtn')}</button>
          <button className="btn btn-outline" onClick={exportCsv}>⬇ {t('ad.orders.exportBtn')}</button></div></>} />

      <div className="alert-success mb-4">
        {t('ad.promo.infoNote', { price: fmt(s.price ?? 5000), days: s.duration_days || 7, max: s.max_active || 3 })}
      </div>

      <div className="grid grid-4 mb-4">
        <StatCard label={t('ad.promo.activeAds')} value={fmt(meta?.total_active ?? 0)} icon="📢" tone="success" />
        <StatCard label={t('ad.promo.activeRevenue')} value={`${fmt(meta?.active_revenue ?? 0)} ${t('ad.currency')}`} icon="💰" tone="accent" />
        <StatCard label={t('ad.promo.totalImpressions')} value={fmt(meta?.total_impressions ?? 0)} icon="👁" tone="info" />
        <StatCard label={t('ad.promo.totalClicks')} value={fmt(meta?.total_clicks ?? 0)} icon="🖱️" tone="primary" />
      </div>

      <div className="filters">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submitSearch(); }}
          placeholder={t('ad.promo.searchPlaceholder')}
          style={{ minWidth: 180 }}
        />
        <button className="btn btn-outline" onClick={submitSearch}>{t('ad.common.search')}</button>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{t('ad.promo.allStatuses')}</option>
          <option value="active">{t('ad.promo.statusActive')}</option>
          <option value="ended">{t('ad.promo.statusEnded')}</option>
        </select>
        <select value={placement} onChange={(e) => setPlacement(e.target.value)}>
          <option value="">{t('ad.promo.allPlacements')}</option>
          <option value="home_top">{t('ad.promo.placementTop')}</option>
          <option value="most_ordered">{t('ad.promo.placementMostOrderedLabel')}</option>
        </select>
        <select value={governorateId} disabled={listsLoading} onChange={(e) => setGovernorateId(e.target.value)}>
          <option value="">{listsLoading ? t('ad.common.loading') : t('ad.cat.allProviders')}</option>
          {governorates.map((g) => <option key={g.id} value={g.id}>{g.name_ar}</option>)}
        </select>
        <select value={serviceId} disabled={listsLoading} onChange={(e) => setServiceId(e.target.value)}>
          <option value="">{listsLoading ? t('ad.common.loading') : t('ad.svc.allServices')}</option>
          {services.map((sv) => <option key={sv.id} value={sv.id}>{sv.name_ar}</option>)}
        </select>
      </div>

      <div className="card">
        <div className="table-wrap">
          {rows.length === 0 ? <EmptyState text={t('ad.promo.empty')} icon="📢" /> : (
            <table>
              <thead>
                <tr>
                  <th>{t('ad.promo.ad')}</th>
                   <th>{t('ad.provider.provider')}</th>
                   <th>{t('ad.agent.gov')}</th>
                   <th>{t('ad.promo.placement')}</th>
                   <th>{t('ad.promo.duration')}</th>
                  <th>{t('ad.promo.cost')}</th>
                  <th>{t('ad.promo.impressions')}</th>
                  <th>{t('ad.promo.clicks')}</th>
                  <th>CTR</th>
                  <th>{t('ad.common.status')}</th>
                  <th>{t('ad.common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row: any) => {
                  const days = remainingDays(row);
                  return (
                    <tr key={row.id}>
                      <td>
                        <div className="flex" style={{ gap: 8, alignItems: 'center' }}>
                          {row.item_image ? (
                            <img src={row.item_image} alt="" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 8 }} />
                          ) : (
                            <div style={{ width: 44, height: 44, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff1f0', fontSize: 20 }}>{row.service_icon || '📢'}</div>
                          )}
                          <div>
                            <div className="bold">{row.item_title}</div>
                            <div className="muted" style={{ fontSize: 12 }}>{fmt(row.item_price)} {t('ad.currency')} · {(LINK_LABELS as any)[row.item_type] || t('ad.promo.linkItem')}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="bold" style={{ fontSize: 13 }}>{row.provider_name}</div>
                        <div className="muted" style={{ fontSize: 11 }}>{row.service_name_ar}</div>
                      </td>
                       <td>
                         {row.target_type === 'all' ? t('ad.promo.allGovernoratesShort') : (row.target_count > 1 ? row.target_label : row.governorate_name_ar)}
                         {row.target_count > 1 && <div className="muted" style={{ fontSize: 11 }}>{t('ad.promo.govCount', { count: String(row.target_count) })}</div>}
                       </td>
                       <td>
                         <span className="badge badge-info">{(PLACEMENT_LABELS as any)[row.placement] || row.placement || t('ad.promo.placementTop')}</span>
                       </td>
                      <td style={{ fontSize: 13 }}>
                        {fmtDate(row.starts_at)}<br />
                        <span className="muted">{t('ad.promo.to')} {fmtDate(row.ends_at)}</span>
                        {days !== null && <div className="muted" style={{ fontSize: 12 }}>{t('ad.promo.remainingDaysShort', { days: String(days) })}</div>}
                      </td>
                      <td className="bold">{fmt(row.cost)} {t('ad.currency')}</td>
                      <td>{fmt(row.impressions)}</td>
                      <td>{fmt(row.clicks)}</td>
                      <td>
                        <span className={row.ctr >= 1 ? 'text-success' : 'muted'}>{row.ctr != null ? `${row.ctr}%` : '0%'}</span>
                      </td>
                      <td><Badge status={row.status} map={PROMO_STATUS} /></td>
                      <td>
                        <div className="flex" style={{ gap: 6 }}>
                          <button className="btn btn-outline btn-sm" onClick={() => setPreviewTarget(row)} title={t('ad.promo.previewTitle')}>👁 {t('ad.promo.previewBtn')}</button>
                          {row.status === 'active' && (
                            <button className="btn btn-outline btn-sm btn-danger-ghost" onClick={() => setEndTarget(row)}>{t('ad.promo.stopBtn')}</button>
                          )}
                          {row.status === 'active' && <span className="muted" style={{ fontSize: 12 }}>≈{fmt(costPerDay)} {t('ad.currency')}/{t('ad.promo.day')}</span>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Pagination meta={meta} page={page} onChange={setPage} />

      <AdPreviewModal open={!!previewTarget} row={previewTarget} onClose={() => setPreviewTarget(null)} />

      <CreateAdModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        governorates={governorates}
        settings={s}
        onCreated={() => load()}
      />

      <Confirm
        open={!!endTarget}
        title={t('ad.promo.stopTitle')}
        message={t('ad.promo.stopMsg', { item: endTarget?.item_title, provider: endTarget?.provider_name })}
        confirmText={t('ad.promo.stopBtn')}
        danger
        onCancel={() => setEndTarget(null)}
        onConfirm={end}
      />
    </div>
  );
}
