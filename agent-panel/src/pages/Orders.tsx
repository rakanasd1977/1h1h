import { useEffect, useState } from 'react';
import { api, downloadFile } from '../api';
import { useAuth } from '../auth';
import { useToast, fmt, fmtDate, PageLoading, EmptyState, Modal, Badge, Field, ORDER_STATUS, Pagination } from '@rafidain/shared/ui';
import type { OrderRow, ProviderOption, OrderDetail, OrderItemJson, OrderHistoryEntry } from '../types';
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
  pending: ['cancelled'],
  confirmed: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: ['cancelled'],
};

const NEXT_STATUS_MAP = NEXT_STATUS as Record<string, string[]>;

export default function Orders() {
  useLocale();
  const [rows, setRows] = useState<OrderRow[] | null>(null);
  const [meta, setMeta] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [provider, setProvider] = useState('');
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [selected, setSelected] = useState<OrderDetail | null>(null);
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [providers, setProviders] = useState<ProviderOption[]>([]);
  const [form, setForm] = useState({ provider_id: '', customer_name: '', customer_phone: '', address: '', notes: '', items: [{ title: '', quantity: '1', unit_price: '' }] });
  const { user } = useAuth();
  const toast = useToast();

  const load = (pg = page) => {
    const p = new URLSearchParams();
    if (status) p.set('status', status);
    if (provider) p.set('provider_id', provider);
    if (q) p.set('q', q);
    if (from) p.set('from', from);
    if (to) p.set('to', to);
    p.set('page', String(pg));
    p.set('limit', '20');
    const qs = p.toString();
    api.get(`/orders${qs ? '?' + qs : ''}`).then((r) => { setRows(r.data); setMeta(r.meta || null); }).catch((e) => toast.error(e.message));
  };
  useEffect(() => { load(); }, [page, status, provider]);
  useEffect(() => { setPage(1); }, [status, provider]);
  useEffect(() => {
    api.get('/providers?limit=100').then((r) => setProviders(r.data)).catch(() => setProviders([]));
  }, []);

  const search = () => { setPage(1); load(1); };

  const remindPending = async () => {
    try {
      const res = await api.post('/agent/orders/remind-pending');
      toast.success(res.data.message);
    } catch (e: any) { toast.error(e.message); }
  };

  const view = async (o: { id: number | string }) => {
    try {
      const res = await api.get(`/orders/${o.id}`);
      setSelected(res.data);
    } catch (e: any) { toast.error(e.message); }
  };

  const exportCsv = async () => {
    try {
      const p = new URLSearchParams();
      if (status) p.set('status', status);
      if (provider) p.set('provider_id', provider);
      if (q) p.set('q', q);
      const qs = p.toString();
      await downloadFile(`/api/orders/export${qs ? '?' + qs : ''}`, `orders-${new Date().toISOString().slice(0, 10)}.csv`);
      toast.success(t('ag.orders.exportToast'));
    } catch (e: any) { toast.error(e.message); }
  };

  const changeStatus = async (next: string) => {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await api.put(`/orders/${selected.id}/status`, { status: next });
      toast.success(t('ag.orders.statusUpdatedToast'));
      setSelected(res.data);
      load();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  const openCreate = () => {
    setForm({ provider_id: '', customer_name: '', customer_phone: '', address: '', notes: '', items: [{ title: '', quantity: '1', unit_price: '' }] });
    setCreateOpen(true);
    api.get('/providers?limit=100').then((r) => setProviders(r.data)).catch(() => setProviders([]));
  };

  const updateItem = (i: number, k: string, v: string) => setForm((f) => ({ ...f, items: f.items.map((it, idx) => (idx === i ? { ...it, [k]: v } : it)) }));
  const addItem = () => setForm((f) => ({ ...f, items: [...f.items, { title: '', quantity: '1', unit_price: '' }] }));
  const removeItem = (i: number) => setForm((f) => ({ ...f, items: f.items.length > 1 ? f.items.filter((_, idx) => idx !== i) : f.items }));

  const createOrder = async () => {
    const items = form.items
      .filter((it) => it.title.trim())
      .map((it) => ({ title: it.title.trim(), quantity: Number(it.quantity) || 1, unit_price: Number(it.unit_price) || 0 }));
    if (!form.provider_id || !form.customer_name.trim() || items.length === 0) {
      toast.error(t('ag.orders.createError'));
      return;
    }
    setCreating(true);
    try {
      const res = await api.post('/orders', {
        provider_id: Number(form.provider_id),
        customer_name: form.customer_name.trim(),
        customer_phone: form.customer_phone.trim() || undefined,
        customer_address: form.address || undefined,
        notes: form.notes || undefined,
        items,
      });
      toast.success(t('ag.orders.createdToast', { number: res.data.order_number }));
      setCreateOpen(false);
      load();
      view({ id: res.data.id });
    } catch (e: any) { toast.error(e.message); } finally { setCreating(false); }
  };

  if (!rows) return <PageLoading />;

  return (
    <div>
      <PageHead title={t('ag.orders.title')} subtitle={t('ag.orders.subtitle')} actions={<><div className="flex wrap">
          <button className="btn btn-primary" onClick={openCreate}>{t('ag.orders.createBtn')}</button>
          <button className="btn btn-outline" onClick={exportCsv}>{t('ag.orders.exportCsv')}</button>
          <button className="btn btn-outline" onClick={remindPending} title={t('ag.orders.remindTitle')}>{t('ag.orders.remindBtn')}</button></div></>} />

      <div className="filters">
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{t('ag.orders.allStatuses')}</option>
          <option value="pending">{t('ag.orders.pending')}</option>
          <option value="confirmed">{t('ag.orders.confirmed')}</option>
          <option value="in_progress">{t('ag.orders.inProgress')}</option>
          <option value="completed">{t('ag.orders.completed')}</option>
          <option value="cancelled">{t('ag.orders.cancelled')}</option>
        </select>
        <select value={provider} onChange={(e) => setProvider(e.target.value)}>
          <option value="">{t('ag.orders.allProviders')}</option>
          {providers.filter((p) => p.governorate_id === user?.governorate_id).map((p) => <option key={p.id} value={p.id}>{p.name_ar}</option>)}
        </select>
        <input placeholder={t('ag.orders.searchPlaceholder')} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} />
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} title={t('ag.orders.fromDate')} />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} title={t('ag.orders.toDate')} />
        <button className="btn btn-outline btn-sm" onClick={search}>{t('ag.orders.searchBtn')}</button>
      </div>

      <div className="card">
        <div className="table-wrap">
          {rows.length === 0 ? <EmptyState text={t('ag.orders.emptyText')} icon="🧾" /> : (
            <table>
              <thead>
                <tr>
                  <th>{t('ag.orders.th.number')}</th><th>{t('ag.orders.th.customer')}</th><th>{t('ag.orders.th.provider')}</th><th>{t('ag.orders.th.service')}</th>
                  <th>{t('ag.orders.th.amount')}</th><th>{t('ag.orders.th.agentComm')}</th><th>{t('ag.orders.th.status')}</th><th>{t('ag.orders.th.date')}</th><th>{t('ag.orders.th.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((o) => (
                  <tr key={o.id}>
                    <td><span className="mono bold">{o.order_number}</span></td>
                    <td>{o.customer_name || o.customer_name_ref || '-'}<div className="muted" style={{ fontSize: 11 }}>{o.customer_phone}</div></td>
                    <td>{o.provider_name}</td>
                    <td><span className="badge badge-blue">{o.service_name_ar}</span></td>
                    <td className="bold">{fmt(o.total_amount)}</td>
                    <td>{fmt(o.agent_amount)}</td>
                    <td><Badge status={o.status} map={ORDER_STATUS} /></td>
                    <td className="muted">{fmtDate(o.created_at)}</td>
                    <td><button className="btn btn-outline btn-sm" onClick={() => view(o)}>{t('ag.orders.detailsBtn')}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Pagination meta={meta} page={page} onChange={setPage} />

      <Modal open={createOpen} title={t('ag.orders.createModalTitle')} onClose={() => setCreateOpen(false)} size="lg">
        <p className="muted mb-4">{t('ag.orders.createHint')}</p>
        <div className="form-grid">
          <Field label={t('ag.orders.fieldProvider')} required>
            <select value={form.provider_id} onChange={(e) => setForm({ ...form, provider_id: e.target.value })}>
              <option value="">{t('ag.orders.chooseProvider')}</option>
              {providers.filter((p) => p.governorate_id === user?.governorate_id).map((p) => <option key={p.id} value={p.id}>{p.name_ar} — {p.service_name_ar}</option>)}
            </select>
          </Field>
          <Field label={t('ag.orders.fieldCustomerName')} required><input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} placeholder={t('ag.orders.customerNameHint')} /></Field>
          <Field label={t('ag.orders.fieldCustomerPhone')}><input value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} placeholder={t('ag.orders.optional')} /></Field>
          <Field label={t('ag.orders.fieldAddress')}><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder={t('ag.orders.optional')} /></Field>
          <Field label={t('ag.orders.fieldNotes')}><input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder={t('ag.orders.optional')} /></Field>
        </div>

        <div className="card-header mt-4"><h3>{t('ag.orders.itemsTitle')}</h3></div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>{t('ag.orders.th.item')}</th><th style={{ width: 90 }}>{t('ag.orders.th.quantity')}</th><th style={{ width: 130 }}>{t('ag.orders.th.unitPrice')}</th><th style={{ width: 130 }}>{t('ag.orders.th.total')}</th><th style={{ width: 50 }}></th></tr>
            </thead>
            <tbody>
              {form.items.map((it, i) => (
                <tr key={i}>
                  <td><input value={it.title} onChange={(e) => updateItem(i, 'title', e.target.value)} placeholder={t('ag.orders.itemDescPlaceholder')} /></td>
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
          <button className="btn btn-outline" onClick={addItem}>{t('ag.orders.addItem')}</button>
          <div className="flex">
            <button className="btn btn-outline" onClick={() => setCreateOpen(false)}>{t('ag.providers.cancel')}</button>
            <button className="btn btn-primary" onClick={createOrder} disabled={creating}>{creating ? t('ag.orders.creating') : t('ag.orders.createBtn2')}</button>
          </div>
        </div>
      </Modal>

      <Modal open={!!selected} title={t('ag.orders.detailModalTitle', { number: selected?.order_number || '' })} onClose={() => setSelected(null)} size="lg">
        {selected && (
          <>
            <div className="detail-grid mb-4">
              <div className="detail-item"><div className="k">{t('ag.orders.detailStatus')}</div><div className="v"><Badge status={selected.status} map={ORDER_STATUS} /></div></div>
              <div className="detail-item"><div className="k">{t('ag.orders.detailProvider')}</div><div className="v">{selected.provider_name}</div></div>
              <div className="detail-item"><div className="k">{t('ag.orders.detailCustomer')}</div><div className="v">{selected.customer_name || selected.customer_name_ref || '-'}<div className="muted">{selected.customer_phone}</div></div></div>
              <div className="detail-item"><div className="k">{t('ag.orders.detailService')}</div><div className="v">{selected.service_name_ar}</div></div>
              <div className="detail-item"><div className="k">{t('ag.orders.detailTotalAmount')}</div><div className="v">{fmt(selected.total_amount)}</div></div>
              <div className="detail-item"><div className="k">{t('ag.orders.detailAgentComm')}</div><div className="v">{fmt(selected.agent_amount)}</div></div>
              <div className="detail-item"><div className="k">{t('ag.orders.detailPlatformComm')}</div><div className="v">{fmt(selected.platform_amount)}</div></div>
              <div className="detail-item"><div className="k">{t('ag.orders.detailCreated')}</div><div className="v">{fmtDate(selected.created_at)}</div></div>
              {selected.accepted_at && <div className="detail-item"><div className="k">{t('ag.orders.detailAccepted')}</div><div className="v">{fmtDate(selected.accepted_at)}</div></div>}
              {selected.status === 'cancelled' && (
                <div className="detail-item" style={{ gridColumn: '1 / -1' }}>
                  <div className="k">{t('ag.orders.detailRejectReason')}</div>
                  <div className="v" style={{ color: 'var(--danger)' }}>{selected.reject_reason || t('ag.orders.detailNoReason')}</div>
                </div>
              )}
            </div>

            {selected.items_json && (
              <div className="card mb-4">
                <div className="card-header"><h3>{t('ag.orders.detailItemsTitle')}</h3></div>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>{t('ag.orders.th.item')}</th><th>{t('ag.orders.th.quantity')}</th><th>{t('ag.orders.th.unitPrice')}</th><th>{t('ag.orders.th.total')}</th></tr></thead>
                    <tbody>
                      {(safeItems(selected.items_json) as OrderItemJson[]).map((it, i) => (
                        <tr key={i}><td>{it.title}</td><td>{it.quantity}</td><td>{fmt(it.unit_price)}</td><td className="bold">{fmt(it.total)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {selected.booking && (
              <div className="card mb-4">
                <div className="card-header"><h3>{t('ag.orders.detailBookingTitle')}</h3></div>
                <div className="detail-grid">
                  <div className="detail-item"><div className="k">{t('ag.orders.detailBookingDate')}</div><div className="v">{selected.booking.booking_date ? fmtDate(selected.booking.booking_date) : '-'}</div></div>
                  <div className="detail-item"><div className="k">{t('ag.orders.detailCheckIn')}</div><div className="v">{selected.booking.check_in ? fmtDate(selected.booking.check_in) : '-'}</div></div>
                  <div className="detail-item"><div className="k">{t('ag.orders.detailCheckOut')}</div><div className="v">{selected.booking.check_out ? fmtDate(selected.booking.check_out) : '-'}</div></div>
                  <div className="detail-item"><div className="k">{t('ag.orders.detailGuests')}</div><div className="v">{selected.booking.guests || '-'}</div></div>
                  {selected.booking.travel_date && <div className="detail-item"><div className="k">{t('ag.orders.detailTravelDate')}</div><div className="v">{fmtDate(selected.booking.travel_date)}</div></div>}
                  {selected.booking.passengers && <div className="detail-item"><div className="k">{t('ag.orders.detailPassengers')}</div><div className="v">{selected.booking.passengers}</div></div>}
                  {selected.booking.nights && <div className="detail-item"><div className="k">{t('ag.orders.detailNights')}</div><div className="v">{selected.booking.nights}</div></div>}
                  {selected.booking.title && <div className="detail-item"><div className="k">{t('ag.orders.detailTitleFlight')}</div><div className="v">{selected.booking.title}</div></div>}
                </div>
              </div>
            )}

            {selected.history && selected.history.length > 0 && (
              <div className="card mb-4">
                <div className="card-header"><h3>{t('ag.orders.historyTitle')}</h3></div>
                <div className="card-body">
                  <div className="timeline">
                    {selected.history.map((h: OrderHistoryEntry, i: number) => {
                      const isLast = i === selected.history.length - 1;
                      return (
                        <div className="timeline__row" key={i}>
                          <div className="timeline__rail">
                            <span className={`timeline__dot${isLast ? ' timeline__dot--current' : ' timeline__dot--done'}`} />
                            {!isLast && <span className="timeline__line timeline__line--done" />}
                          </div>
                          <div className="timeline__body">
                            <div className={`timeline__label${isLast ? ' timeline__label--current' : ' timeline__label--done'}`}>
                              {t((ORDER_STATUS[h.status] || {}).label || h.status)}
                            </div>
                            <div className="timeline__date">{fmtDate(h.at)}</div>
                            {h.by_name && (
                              <div className="timeline__actor">
                                {t('ag.orders.timelineBy')} {h.by_name}{' '}
                                {h.by === 'agent' ? t('ag.orders.agent') : h.by === 'provider' ? t('ag.orders.providerParen') : h.by === 'customer' ? t('ag.orders.customerParen') : h.by === 'admin' ? t('ag.orders.adminParen') : ''}
                              </div>
                            )}
                            {h.note && <div className="timeline__note" style={{ color: 'var(--danger)' }}>{t('ag.orders.cancelReason')} {h.note}</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            <div className="card">
              <div className="card-header"><h3>{t('ag.orders.changeStatus')}</h3></div>
              <div className="card-body flex wrap">
                {(NEXT_STATUS_MAP[selected.status] || []).map((s) => (
                  <button key={s} className="btn btn-outline" disabled={saving} onClick={() => changeStatus(s)}>{t('ag.orders.transferTo')} {t(ORDER_STATUS[s].label)}</button>
                ))}
                {(NEXT_STATUS_MAP[selected.status] || []).length === 0 && <span className="muted">{t('ag.orders.noTransitions')}</span>}
              </div>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
