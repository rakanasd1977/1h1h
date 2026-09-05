import { useEffect, useState } from 'react';
import { api, downloadFile } from '../api';
import { useToast, fmt, fmtDate, PageLoading, EmptyState, Modal, Badge, Field, ORDER_STATUS, Pagination } from '@rafidain/shared/ui';
import { PageHead } from '@rafidain/shared/ui';
import { t } from '@rafidain/shared/i18n';
import { useLocale } from '@rafidain/shared';

function safeItems(raw: string | null | undefined): any[] {
  try {
    const v = JSON.parse(raw || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

const NEXT_STATUS = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: ['cancelled'],
};

export default function Orders() {
  useLocale();
  const STATUS_OPTIONS = [
    { value: '', label: t('ad.orders.allStatuses') },
    { value: 'pending', label: t('ad.orders.pending') },
    { value: 'confirmed', label: t('ad.orders.confirmed') },
    { value: 'in_progress', label: t('ad.orders.inProgress') },
    { value: 'completed', label: t('ad.orders.completed') },
    { value: 'cancelled', label: t('ad.orders.cancelled') },
  ];
  const [rows, setRows] = useState<any>(null);
  const [meta, setMeta] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [providers, setProviders] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [form, setForm] = useState({ provider_id: '', customer_id: '', address: '', notes: '', items: [{ title: '', quantity: '1', unit_price: '' }] });
  const toast = useToast();

  const load = (pg = page) => {
    const p = new URLSearchParams();
    if (status) p.set('status', status);
    if (q) p.set('q', q);
    if (from) p.set('from', from);
    if (to) p.set('to', to);
    p.set('page', String(pg));
    p.set('limit', '20');
    const qs = p.toString();
    api.get(`/orders${qs ? '?' + qs : ''}`).then((r) => { setRows(r.data); setMeta(r.meta || null); }).catch((e) => toast.error(e.message));
  };
  useEffect(() => { load(); }, [page, status]);
  useEffect(() => { setPage(1); }, [status]);

  const search = () => { setPage(1); load(1); };

  const view = async (o: any) => {
    try {
      const res = await api.get(`/orders/${o.id}`);
      setSelected(res.data);
    } catch (e: any) { toast.error(e.message); }
  };

  const changeStatus = async (next: any) => {
    setSaving(true);
    try {
      const res = await api.put(`/orders/${selected.id}/status`, { status: next });
      toast.success(t('ad.orders.statusUpdated'));
      setSelected(res.data);
      load();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  const exportCsv = async () => {
    try {
      const p = new URLSearchParams();
      if (status) p.set('status', status);
      if (q) p.set('q', q);
      if (from) p.set('from', from);
      if (to) p.set('to', to);
      const qs = p.toString();
      await downloadFile(`/api/orders/export${qs ? '?' + qs : ''}`, `orders-${new Date().toISOString().slice(0, 10)}.csv`);
      toast.success(t('ad.orders.exported'));
    } catch (e: any) { toast.error(e.message); }
  };

  const openCreate = () => {
    setForm({ provider_id: '', customer_id: '', address: '', notes: '', items: [{ title: '', quantity: '1', unit_price: '' }] });
    setCreateOpen(true);
  api.get('/providers?limit=100').then((r) => setProviders(r.data)).catch(() => setProviders([]));
  api.get('/customers?limit=100').then((r) => setCustomers(r.data)).catch(() => setCustomers([]));
  };

  const updateItem = (i: any, k: any, v: any) => setForm((f) => ({ ...f, items: f.items.map((it, idx) => (idx === i ? { ...it, [k]: v } : it)) }));
  const addItem = () => setForm((f) => ({ ...f, items: [...f.items, { title: '', quantity: '1', unit_price: '' }] }));
  const removeItem = (i: any) => setForm((f) => ({ ...f, items: f.items.length > 1 ? f.items.filter((_, idx) => idx !== i) : f.items }));

  const createOrder = async () => {
    const items = form.items
      .filter((it) => it.title.trim())
      .map((it) => ({ title: it.title.trim(), quantity: Number(it.quantity) || 1, unit_price: Number(it.unit_price) || 0 }));
    if (!form.provider_id || !form.customer_id || items.length === 0) {
      toast.error(t('ad.orders.createRequired'));
      return;
    }
    const customer = customers.find((c) => c.id === Number(form.customer_id));
    setCreating(true);
    try {
      const res = await api.post('/orders', {
        provider_id: Number(form.provider_id),
        customer_id: customer ? customer.user_id : Number(form.customer_id),
        items,
        customer_address: form.address || undefined,
        notes: form.notes || undefined,
      });
      toast.success(t('ad.orders.created', { number: res.data.order_number }));
      setCreateOpen(false);
      load();
      view({ id: res.data.id });
    } catch (e: any) { toast.error(e.message); } finally { setCreating(false); }
  };

  if (!rows) return <PageLoading />;

  return (
    <div>
      <PageHead title={t('ad.orders.title')} subtitle={t('ad.orders.subtitle')} actions={<><div className="flex">
          <button className="btn btn-primary" onClick={openCreate}>+ {t('ad.orders.createBtn')}</button>
          <button className="btn btn-outline" onClick={exportCsv}>⬇ {t('ad.orders.exportBtn')}</button></div></>} />

      <div className="filters">
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <input placeholder={t('ad.orders.searchPlaceholder')} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} />
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} title={t('ad.orders.fromDate')} />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} title={t('ad.orders.toDate')} />
        <button className="btn btn-outline btn-sm" onClick={search}>{t('ad.common.search')}</button>
      </div>

      <div className="card">
        <div className="table-wrap">
          {rows.length === 0 ? <EmptyState text={t('ad.orders.empty')} icon="🧾" /> : (
            <table>
              <thead>
                <tr>
                  <th>{t('ad.orders.orderNumber')}</th><th>{t('ad.orders.customer')}</th><th>{t('ad.orders.provider')}</th><th>{t('ad.svc.service')}</th><th>{t('ad.agent.gov')}</th>
                  <th>{t('ad.orders.amount')}</th><th>{t('ad.common.status')}</th><th>{t('ad.orders.date')}</th><th>{t('ad.common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((o: any) => (
                  <tr key={o.id}>
                    <td><span className="mono bold">{o.order_number}</span></td>
                    <td>{o.customer_name || o.customer_name_ref || '-'}<div className="muted" style={{ fontSize: 11 }}>{o.customer_phone}</div></td>
                    <td>{o.provider_name}</td>
                    <td><span className="badge badge-blue">{o.service_name_ar}</span></td>
                    <td><span className="badge badge-teal">{o.governorate_name_ar}</span></td>
                    <td className="bold">{fmt(o.total_amount)}</td>
                    <td><Badge status={o.status} map={ORDER_STATUS} /></td>
                    <td className="muted">{fmtDate(o.created_at)}</td>
                    <td><button className="btn btn-outline btn-sm" onClick={() => view(o)}>{t('ad.common.details')}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Pagination meta={meta} page={page} onChange={setPage} />

      <Modal open={createOpen} title={t('ad.orders.createTitle')} onClose={() => setCreateOpen(false)} size="lg">
        <p className="muted mb-4">{t('ad.orders.createNote')}</p>
        <div className="form-grid">
          <Field label={t('ad.provider.provider')} required>
            <select value={form.provider_id} onChange={(e) => setForm({ ...form, provider_id: e.target.value })}>
              <option value="">{t('ad.orders.chooseProvider')}</option>
              {providers.map((p) => <option key={p.id} value={p.id}>{p.name_ar} — {p.service_name_ar} ({p.governorate_name_ar})</option>)}
            </select>
          </Field>
          <Field label={t('ad.orders.customer')} required>
            <select value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })}>
              <option value="">{t('ad.orders.chooseCustomer')}</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name_ar} — {c.phone || c.email}</option>)}
            </select>
          </Field>
          <Field label={t('ad.orders.address')}><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder={t('ad.orders.optional')} /></Field>
          <Field label={t('ad.orders.notes')}><input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder={t('ad.orders.optional')} /></Field>
        </div>

        <div className="card-header mt-4"><h3>{t('ad.orders.items')}</h3></div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>{t('ad.orders.item')}</th><th style={{ width: 90 }}>{t('ad.orders.quantity')}</th><th style={{ width: 130 }}>{t('ad.orders.unitPrice')}</th><th style={{ width: 130 }}>{t('ad.orders.total')}</th><th style={{ width: 50 }}></th></tr>
            </thead>
            <tbody>
              {form.items.map((it, i) => (
                <tr key={i}>
                  <td><input value={it.title} onChange={(e) => updateItem(i, 'title', e.target.value)} placeholder={t('ad.orders.itemDesc')} /></td>
                  <td><input type="number" min="1" value={it.quantity} onChange={(e) => updateItem(i, 'quantity', e.target.value)} /></td>
                  <td><input type="number" min="0" value={it.unit_price} onChange={(e) => updateItem(i, 'unit_price', e.target.value)} /></td>
                  <td className="bold">{fmt((Number(it.quantity) || 0) * (Number(it.unit_price) || 0))}</td>
                  <td><button className="btn btn-danger btn-sm" onClick={() => removeItem(i)}>×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex-between mt-4">
          <button className="btn btn-outline" onClick={addItem}>+ {t('ad.orders.addItem')}</button>
          <div className="flex">
            <button className="btn btn-outline" onClick={() => setCreateOpen(false)}>{t('ad.common.cancel')}</button>
            <button className="btn btn-primary" onClick={createOrder} disabled={creating}>{creating ? t('ad.common.creating') : t('ad.orders.createOrderBtn')}</button>
          </div>
        </div>
      </Modal>

      <Modal open={!!selected} title={`${t('ad.orders.order')} ${selected?.order_number || ''}`} onClose={() => setSelected(null)} size="lg">
        {selected && (
          <>
            <div className="detail-grid mb-4">
              <div className="detail-item"><div className="k">{t('ad.common.status')}</div><div className="v"><Badge status={selected.status} map={ORDER_STATUS} /></div></div>
              <div className="detail-item"><div className="k">{t('ad.provider.provider')}</div><div className="v">{selected.provider_name}</div></div>
              <div className="detail-item"><div className="k">{t('ad.orders.customer')}</div><div className="v">{selected.customer_name || selected.customer_name_ref || '-'}<div className="muted">{selected.customer_phone}</div></div></div>
              <div className="detail-item"><div className="k">{t('ad.orders.govService')}</div><div className="v">{selected.governorate_name_ar} — {selected.service_name_ar}</div></div>
              <div className="detail-item"><div className="k">{t('ad.orders.amount')}</div><div className="v">{fmt(selected.total_amount)}</div></div>
              <div className="detail-item"><div className="k">{t('ad.orders.commissionTotal')}</div><div className="v">{fmt(selected.commission_amount)}</div></div>
              <div className="detail-item"><div className="k">{t('ad.orders.platformShare')}</div><div className="v">{fmt(selected.platform_amount)}</div></div>
              <div className="detail-item"><div className="k">{t('ad.orders.agentShare')}</div><div className="v">{fmt(selected.agent_amount)}</div></div>
              <div className="detail-item"><div className="k">{t('ad.orders.providerShare')}</div><div className="v">{fmt(selected.provider_amount)}</div></div>
              <div className="detail-item"><div className="k">{t('ad.orders.createdDate')}</div><div className="v">{fmtDate(selected.created_at)}</div></div>
              {selected.accepted_at && <div className="detail-item"><div className="k">{t('ad.orders.acceptedDate')}</div><div className="v">{fmtDate(selected.accepted_at)}</div></div>}
              {selected.status === 'cancelled' && (
                <div className="detail-item" style={{ gridColumn: '1 / -1' }}>
                  <div className="k">{t('ad.orders.rejectReason')}</div>
                  <div className="v" style={{ color: 'var(--danger)' }}>{selected.reject_reason || t('ad.orders.noReason')}</div>
                </div>
              )}
            </div>

            {selected.items_json && (
              <div className="card mb-4">
                <div className="card-header"><h3>{t('ad.orders.items')}</h3></div>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>{t('ad.orders.item')}</th><th>{t('ad.orders.quantity')}</th><th>{t('ad.orders.unitPrice')}</th><th>{t('ad.orders.total')}</th></tr></thead>
                    <tbody>
                      {safeItems(selected.items_json).map((it: any, i: any) => (
                        <tr key={i}>
                          <td>{it.title}</td><td>{it.quantity}</td><td>{fmt(it.unit_price)}</td><td className="bold">{fmt(it.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {selected.notes && <div className="alert-info mb-4"><strong>{t('ad.orders.notes')}:</strong> {selected.notes}</div>}

            {selected.booking && (
              <div className="card mb-4">
                <div className="card-header"><h3>📅 {t('ad.orders.bookingData')}</h3></div>
                <div className="detail-grid">
                  <div className="detail-item"><div className="k">{t('ad.orders.bookingDate')}</div><div className="v">{selected.booking.booking_date ? fmtDate(selected.booking.booking_date) : '-'}</div></div>
                  <div className="detail-item"><div className="k">{t('ad.orders.checkIn')}</div><div className="v">{selected.booking.check_in ? fmtDate(selected.booking.check_in) : '-'}</div></div>
                  <div className="detail-item"><div className="k">{t('ad.orders.checkOut')}</div><div className="v">{selected.booking.check_out ? fmtDate(selected.booking.check_out) : '-'}</div></div>
                  <div className="detail-item"><div className="k">{t('ad.orders.guests')}</div><div className="v">{selected.booking.guests || '-'}</div></div>
                  {selected.booking.travel_date && <div className="detail-item"><div className="k">{t('ad.orders.travelDate')}</div><div className="v">{fmtDate(selected.booking.travel_date)}</div></div>}
                  {selected.booking.passengers && <div className="detail-item"><div className="k">{t('ad.orders.passengers')}</div><div className="v">{selected.booking.passengers}</div></div>}
                  {selected.booking.nights && <div className="detail-item"><div className="k">{t('ad.orders.nights')}</div><div className="v">{selected.booking.nights}</div></div>}
                  {selected.booking.title && <div className="detail-item"><div className="k">{t('ad.orders.bookingTitle')}</div><div className="v">{selected.booking.title}</div></div>}
                </div>
              </div>
            )}

            <div className="card">
              <div className="card-header"><h3>{t('ad.orders.changeStatus')}</h3></div>
              <div className="card-body flex wrap">
                {((NEXT_STATUS as any)[selected.status] || []).map((s: any) => (
                  <button key={s} className="btn btn-outline" disabled={saving} onClick={() => changeStatus(s)}>
                    {t('ad.orders.moveTo')}: {ORDER_STATUS[s].label}
                  </button>
                ))}
                {((NEXT_STATUS as any)[selected.status] || []).length === 0 && <span className="muted">{t('ad.orders.noTransition')}</span>}
              </div>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
