import { useState, useEffect } from 'react';
import { api } from '../api';
import { useToast, fmt, fmtDate, PageLoading, StatCard, Badge, Field, Modal, EmptyState, Confirm, Pagination } from '@rafidain/shared/ui';
import { PageHead } from '@rafidain/shared/ui';
import { t } from '@rafidain/shared/i18n';
import { useLocale } from '@rafidain/shared';
import { useAuth } from '../auth';
import { CATALOGS } from '../catalog';

const PROMO_STATUSES: Record<string, any> = {
  active: { label: 'pr.promos.statusActive', cls: 'badge-green' },
  ended: { label: 'pr.promos.statusEnded', cls: 'badge-gray' },
};

function rowImage(row: any): string {
  const raw = row.images ?? row.images_json ?? '';
  if (Array.isArray(raw)) return raw[0] || '';
  if (typeof raw === 'string') {
    try {
      const a = JSON.parse(raw);
      if (Array.isArray(a)) return a[0] || '';
    } catch { /* keep going */ }
    return raw.split(',')[0].trim();
  }
  return '';
}

function itemTitle(row: any, config: any): string {
  if (config && config.itemType === 'flights') return row.flight_number || row.name_ar || row.title;
  return row.name_ar || row.title || row.flight_number || `#${row.id}`;
}

function itemPrice(row: any): number {
  return Number(row.price ?? row.price_per_night ?? 0);
}

function CreatePromoModal({ open, onClose, config, onCreated, settings, walletBalance, preset }: {
  open: boolean;
  onClose: () => void;
  config?: any;
  onCreated?: () => void;
  settings?: any;
  walletBalance?: number;
  preset?: any;
}) {
  const [items, setItems] = useState<any[]>([]);
  const [meta, setMeta] = useState<any>(null);
  const [selected, setSelected] = useState<any>(null);
  const [days, setDays] = useState('');
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  useLocale();

  const s = settings || meta?.settings;
  const baseDays = Math.max(1, Number(s?.duration_days) || 7);
  const price = Math.max(0, Number(s?.price) || 0);
  const dur = Math.max(1, Math.min(90, Number(days) || baseDays));
  const estCost = Math.round((price / baseDays) * dur * 100) / 100;
  const balance = Number(walletBalance ?? meta?.wallet_balance) || 0;

  const load = () => {
    if (!config) return;
    api.get(config.api).then((r) => setItems(r.data)).catch(() => setItems([]));
    if (!settings) {
      api.get('/promotions?limit=1').then((r) => setMeta(r.meta || null)).catch(() => setMeta(null));
    }
  };

  useEffect(() => {
    if (open) {
      setSelected(null);
      setDays(String(baseDays));
      load();
    }
  }, [open]);

  useEffect(() => {
    if (open && preset && items.length > 0 && !selected) {
      const found = items.find((i: any) => Number(i.id) === Number(preset.id));
      if (found) setSelected(found);
    }
  }, [open, preset, items]);

  const create = async () => {
    if (!selected) { toast.error(t('pr.promos.chooseError')); return; }
    setSaving(true);
    try {
      await api.post('/promotions', { item_type: config.itemType, item_id: selected.id, duration_days: dur });
      toast.success(t('pr.promos.createdToast'));
      onClose();
      onCreated?.();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  return (
    <Modal open={open} title={t('pr.promos.createTitle')} onClose={onClose} size="lg">
      <p className="muted mb-4">{t('pr.promos.chooseItem')}</p>
      <div style={{ height: 300, overflow: 'auto' }}>
        {items.length === 0 && <EmptyState text={t('pr.promos.noItems')} icon="📦" />}
        {items.map((row: any) => {
          const img = rowImage(row);
          return (
            <div key={row.id} onClick={() => setSelected(row)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 10, border: '1px solid var(--border)', borderRadius: 12, marginBottom: 8, background: selected?.id === row.id ? 'var(--primary-2, #eef2ff)' : 'transparent', cursor: 'pointer' }}>
              {img ? <img src={img} alt="" style={{ width: 46, height: 46, borderRadius: 8, objectFit: 'cover' }} /> : <div style={{ width: 46, height: 46, borderRadius: 8, background: 'var(--bg)' }} />}
              <div>
                <div className="bold">{itemTitle(row, config)}</div>
                <div className="muted">{fmt(itemPrice(row))} د.ع</div>
              </div>
            </div>
          );
        })}
      </div>
      <Field label={t('pr.promos.durationDays')} full>
        <input type="number" min="1" max="90" value={days} onChange={(e) => setDays(e.target.value)} />
        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{t('pr.promos.durationHint', { days: String(baseDays) })}</div>
      </Field>
      <p className="muted" style={{ marginTop: 8, fontSize: 13 }}>{t('pr.promos.billingHint')}</p>
      <div className="detail-grid" style={{ marginTop: 8 }}>
        <div className="detail-item"><div className="k">{t('pr.promos.estimatedCost')}</div><div className="v bold">{fmt(estCost)}</div></div>
        <div className="detail-item"><div className="k">{t('pr.promos.walletBalance')}</div><div className="v">{fmt(balance)}</div></div>
      </div>
      {estCost > balance && (
        <p className="muted" style={{ color: 'var(--danger)', marginTop: 8, fontSize: 13 }}>{t('pr.promos.insufficientBalance')}</p>
      )}
      <div className="form-actions">
        <button className="btn btn-outline" onClick={onClose}>{t('pr.promos.cancel')}</button>
        <button className="btn btn-primary" onClick={create} disabled={saving || !selected || estCost > balance}>{saving ? t('pr.promos.saving') : t('pr.promos.createAction')}</button>
      </div>
    </Modal>
  );
}

export function PromoteModal(props: { open: boolean; onClose: () => void; onCreated?: () => void; config?: any; preset?: any }) {
  return <CreatePromoModal {...props} />;
}

export default function Promotions() {
  const { user } = useAuth();
  const [rows, setRows] = useState<any>(null);
  const [meta, setMeta] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [promoOpen, setPromoOpen] = useState(false);
  const [extendTarget, setExtendTarget] = useState<any>(null);
  const [endTarget, setEndTarget] = useState<any>(null);
  const toast = useToast();
  useLocale();

  const load = (pg = page) => {
    const p = new URLSearchParams();
    p.set('page', String(pg));
    p.set('limit', '20');
    api.get(`/promotions?${p.toString()}`).then((r) => { setRows(r.data); setMeta(r.meta || null); }).catch((e) => toast.error(e.message));
  };
  useEffect(() => { load(); }, [page]);

  const extend = async () => {
    try {
      await api.post(`/promotions/${extendTarget.id}/extend`);
      toast.success(t('pr.promos.extendedToast'));
      setExtendTarget(null);
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const end = async () => {
    try {
      await api.del(`/promotions/${endTarget.id}`);
      toast.success(t('pr.promos.endedToast'));
      setEndTarget(null);
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  if (!rows) return <PageLoading />;

  const config = (CATALOGS as Record<string, any>)[user?.service_type];
  const extendCost = Math.max(0, Number(meta?.settings?.price) || 0);

  return (
    <div>
      <PageHead title={t('pr.promos.title')} subtitle={t('pr.promos.subtitle')} actions={<button className="btn btn-primary" onClick={() => setPromoOpen(true)}>{t('pr.promos.createBtn')}</button>} />

      <div className="grid grid-4 mb-4">
        <StatCard label={t('pr.promos.totalLabel')} value={String(meta?.total ?? 0)} icon="📢" tone="primary" />
        <StatCard label={t('pr.promos.activeLabel')} value={String(meta?.active_count ?? 0)} icon="✅" tone="success" />
        <StatCard label={t('pr.promos.impressionsLabel')} value={fmt(meta?.impressions ?? 0)} icon="👁️" tone="info" />
        <StatCard label={t('pr.promos.clicksLabel')} value={fmt(meta?.clicks ?? 0)} icon="👆" tone="info" />
      </div>

      <div className="card">
        <div className="table-wrap">
          {rows.length === 0 ? <EmptyState text={t('pr.promos.empty')} icon="📢" /> : (
            <table>
              <thead>
                <tr>
                  <th>{t('pr.promos.thItem')}</th><th>{t('pr.promos.thCost')}</th><th>{t('pr.promos.thTarget')}</th>
                  <th>{t('pr.promos.thImpressions')}</th><th>{t('pr.promos.thClicks')}</th>
                  <th>{t('pr.promos.thEndsAt')}</th><th>{t('pr.promos.thStatus')}</th><th>{t('pr.promos.thActions')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p: any) => (
                  <tr key={p.id}>
                    <td>
                      <div className="flex gap-sm" style={{ alignItems: 'center' }}>
                        {p.item_image && <img src={p.item_image} alt="" style={{ width: 34, height: 34, borderRadius: 8, objectFit: 'cover' }} />}
                        <div>
                          <div className="bold">{p.item_title}</div>
                          <div className="muted" style={{ fontSize: 11 }}>{fmt(p.item_price)} د.ع</div>
                        </div>
                      </div>
                    </td>
                    <td>{fmt(p.cost)}</td>
                    <td className="muted">{p.governorate_name_ar || '-'}</td>
                    <td>{Number(p.impressions) || 0}</td>
                    <td>{Number(p.clicks) || 0}</td>
                    <td className="muted">{p.ends_at ? fmtDate(p.ends_at) : '-'}</td>
                    <td><Badge status={p.status} map={PROMO_STATUSES} /></td>
                    <td>
                      <div className="flex gap-sm">
                        {p.status === 'active' && <button className="btn btn-outline btn-sm" onClick={() => setExtendTarget(p)}>{t('pr.promos.extendBtn')}</button>}
                        {p.status === 'active' && <button className="btn btn-outline btn-sm btn-danger-ghost" onClick={() => setEndTarget(p)}>{t('pr.promos.endBtn')}</button>}
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

      <CreatePromoModal open={promoOpen} onClose={() => setPromoOpen(false)} config={config} onCreated={load} settings={meta?.settings} walletBalance={meta?.wallet_balance} />

      <Confirm open={!!extendTarget} title={t('pr.promos.extendTitle')} message={t('pr.promos.extendMsg', { days: String(meta?.settings?.duration_days ?? 7), cost: String(extendCost) })} confirmText={t('pr.promos.confirm')} onCancel={() => setExtendTarget(null)} onConfirm={extend} />

      <Confirm open={!!endTarget} title={t('pr.promos.endTitle')} message={t('pr.promos.endMsg')} confirmText={t('pr.promos.confirm')} danger onCancel={() => setEndTarget(null)} onConfirm={end} />
    </div>
  );
}