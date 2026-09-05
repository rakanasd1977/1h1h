import { useEffect, useState } from 'react';
import { api, downloadFile } from '../api';
import { useToast, fmt, fmtDate, PageLoading, EmptyState, Modal, Badge, Field, ORDER_STATUS, Pagination } from '@rafidain/shared/ui';
import { CATALOGS } from '../catalog';
import { useAuth } from '../auth';
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

const NEXT_STATUS: Record<string, string[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: ['cancelled'],
};

const EMPTY_FORM = { customer_name: '', customer_phone: '', customer_address: '', notes: '', items: [{ title: '', quantity: '1', unit_price: '' }] };

export default function Orders() {
  const { user } = useAuth();
  const [rows, setRows] = useState<any>(null);
  const [meta, setMeta] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState(() => new URLSearchParams(window.location.search).get('status') || '');
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const toast = useToast();
  useLocale();

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

  const exportCsv = async () => {
    try {
      const p = new URLSearchParams();
      if (status) p.set('status', status);
      if (q) p.set('q', q);
      if (from) p.set('from', from);
      if (to) p.set('to', to);
      const qs = p.toString();
      await downloadFile(`/api/orders/export${qs ? '?' + qs : ''}`, `orders-${new Date().toISOString().slice(0, 10)}.csv`);
      toast.success(t('pr.orders.exportToast'));
    } catch (e: any) { toast.error(e.message); }
  };

  const view = async (o: any) => {
    try {
      const res = await api.get(`/orders/${o.id}`);
      setSelected(res.data);
    } catch (e: any) { toast.error(e.message); }
  };

  const changeStatus = async (next: any, reason = '') => {
    setSaving(true);
    try {
      const res = await api.put(`/orders/${selected.id}/status`, { status: next, reason });
      toast.success(next === 'confirmed' ? t('pr.orders.acceptToast') : t('pr.orders.statusUpdatedToast'));
      setSelected(res.data);
      setRejectOpen(false);
      setRejectReason('');
      load();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  const confirmOrder = () => {
    if (!window.confirm(t('pr.orders.acceptConfirm'))) return;
    changeStatus('confirmed');
  };

  const updateItem = (i: number, k: string, v: any) => setForm((f) => ({ ...f, items: f.items.map((it, idx) => (idx === i ? { ...it, [k]: v } : it)) }));
  const addItem = () => setForm((f) => ({ ...f, items: [...f.items, { title: '', quantity: '1', unit_price: '' }] }));
  const removeItem = (i: number) => setForm((f) => ({ ...f, items: f.items.length > 1 ? f.items.filter((_, idx) => idx !== i) : f.items }));

  const createOrder = async () => {
    const items = form.items
      .filter((it) => it.title.trim())
      .map((it) => ({ title: it.title.trim(), quantity: Number(it.quantity) || 1, unit_price: Number(it.unit_price) || 0 }));
    if (!form.customer_name.trim() || items.length === 0) {
      toast.error(t('pr.orders.createError'));
      return;
    }
    setCreating(true);
    try {
      const res = await api.post('/orders', {
        provider_id: user.provider_id,
        customer_name: form.customer_name.trim(),
        customer_phone: form.customer_phone.trim() || undefined,
        customer_address: form.customer_address || undefined,
        notes: form.notes || undefined,
        items,
      });
      toast.success(t('pr.orders.createdToast', { number: res.data.order_number }));
      setCreateOpen(false);
      setForm(EMPTY_FORM);
      load();
      view({ id: res.data.id });
    } catch (e: any) { toast.error(e.message); } finally { setCreating(false); }
  };

  if (!rows) return <PageLoading />;

  const cat = (CATALOGS as Record<string, any>)[user.service_type];

  return (
    <div>
      <PageHead title={t('pr.orders.title')} subtitle={t('pr.orders.subtitle')} actions={<><button className="btn btn-outline" onClick={exportCsv}>{t('pr.orders.exportCsv')}</button>
        <button className="btn btn-primary" onClick={() => { setForm(EMPTY_FORM); setCreateOpen(true); }}>{t('pr.orders.createBtn')}</button></>} />

      <div className="filters">
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{t('pr.orders.allStatuses')}</option>
          <option value="pending">{t('status.pending')}</option>
          <option value="confirmed">{t('status.confirmed')}</option>
          <option value="in_progress">{t('status.in_progress')}</option>
          <option value="completed">{t('status.completed')}</option>
          <option value="cancelled">{t('status.cancelled')}</option>
        </select>
        <input placeholder={t('pr.orders.searchPlaceholder')} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} />
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} title={t('pr.orders.fromDate')} />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} title={t('pr.orders.toDate')} />
        <button className="btn btn-outline btn-sm" onClick={search}>{t('pr.orders.searchBtn')}</button>
      </div>

      <div className="card">
        <div className="table-wrap">
          {rows.length === 0 ? <EmptyState text={t('pr.orders.empty')} icon="🧾" /> : (
            <table>
              <thead>
                <tr>
                  <th>{t('pr.orders.thOrder')}</th><th>{t('pr.orders.thCustomer')}</th><th>{t('pr.orders.thAmount')}</th><th>{t('pr.orders.thPlatformComm')}</th>
                  <th>{t('pr.orders.thNetIncome')}</th><th>{t('pr.orders.thStatus')}</th><th>{t('pr.orders.thDate')}</th><th>{t('pr.orders.thActions')}</th>
                </tr>
              </thead>
              <tbody>
                 {rows.map((o: any) => (
                  <tr key={o.id}>
                    <td><span className="mono bold">{o.order_number}</span></td>
                    <td>{o.status === 'pending' ? <span className="muted">{t('pr.orders.customerHidden')}</span> : (o.customer_name || o.customer_name_ref || '-')}<div className="muted" style={{ fontSize: 11 }}>{o.status === 'pending' ? '' : o.customer_phone}</div></td>
                    <td className="bold">{fmt(o.total_amount)}</td>
                    <td>{fmt(o.commission_amount)}</td>
                    <td className="bold" style={{ color: 'var(--success)' }}>{fmt(o.provider_amount)}</td>
                    <td><Badge status={o.status} map={ORDER_STATUS} /></td>
                    <td className="muted">{fmtDate(o.created_at)}</td>
                    <td><button className="btn btn-outline btn-sm" onClick={() => view(o)}>{t('pr.orders.detailsBtn')}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Pagination meta={meta} page={page} onChange={setPage} />

      <Modal open={createOpen} title={t('pr.orders.createModalTitle')} onClose={() => setCreateOpen(false)} size="lg">
        <p className="muted mb-4">{t('pr.orders.createHint')}</p>
        <div className="form-grid">
          <Field label={t('pr.orders.fieldCustomerName')} required><input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} placeholder={t('pr.orders.customerNamePlaceholder')} /></Field>
          <Field label={t('pr.orders.fieldCustomerPhone')}><input value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} placeholder={t('pr.orders.optional')} /></Field>
          <Field label={t('pr.orders.fieldAddress')}><input value={form.customer_address} onChange={(e) => setForm({ ...form, customer_address: e.target.value })} placeholder={t('pr.orders.optional')} /></Field>
          <Field label={t('pr.orders.fieldNotes')}><input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder={t('pr.orders.optional')} /></Field>
        </div>

        <div className="card-header mt-4"><h3>{t('pr.orders.itemsTitle')}</h3></div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>{t('pr.orders.thItem')}</th><th style={{ width: 90 }}>{t('pr.orders.thQty')}</th><th style={{ width: 130 }}>{t('pr.orders.thUnitPrice')}</th><th style={{ width: 130 }}>{t('pr.orders.thTotal')}</th><th style={{ width: 50 }}></th></tr>
            </thead>
            <tbody>
              {form.items.map((it, i) => (
                <tr key={i}>
                  <td><input value={it.title} onChange={(e) => updateItem(i, 'title', e.target.value)} placeholder={t('pr.orders.itemPlaceholder')} /></td>
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
          <button className="btn btn-outline" onClick={addItem}>{t('pr.orders.addItem')}</button>
          <div className="flex">
            <button className="btn btn-outline" onClick={() => setCreateOpen(false)}>{t('pr.orders.cancelReject')}</button>
            <button className="btn btn-primary" onClick={createOrder} disabled={creating}>{creating ? t('pr.orders.creating') : t('pr.orders.createBtn2')}</button>
          </div>
        </div>
      </Modal>

      <Modal open={!!selected} title={t('pr.orders.modalTitle', { number: selected?.order_number || '' })} onClose={() => setSelected(null)} size="lg">
        {selected && (
          <>
            <div className="detail-grid mb-4">
              <div className="detail-item"><div className="k">{t('pr.orders.statusDetail')}</div><div className="v"><Badge status={selected.status} map={ORDER_STATUS} /></div></div>
              {selected.status === 'pending' ? (
                <div className="detail-item" style={{ gridColumn: '1 / -1' }}>
                  <div className="k">{t('pr.orders.customerData')}</div>
                  <div className="v muted">{t('pr.orders.customerHiddenDetail')}</div>
                </div>
              ) : (
                <>
                  <div className="detail-item"><div className="k">{t('pr.orders.customerLabel')}</div><div className="v">{selected.customer_name || selected.customer_name_ref || '-'}<div className="muted">{selected.customer_phone}</div></div></div>
                  {selected.customer_address && <div className="detail-item" style={{ gridColumn: '1 / -1' }}><div className="k">{t('pr.orders.customerAddress')}</div><div className="v">{selected.customer_address}</div></div>}
                </>
              )}
              <div className="detail-item"><div className="k">{t('pr.orders.totalAmount')}</div><div className="v">{fmt(selected.total_amount)}</div></div>
              <div className="detail-item"><div className="k">{t('pr.orders.platformCommDetail')}</div><div className="v">{fmt(selected.commission_amount)}</div></div>
              <div className="detail-item"><div className="k">{t('pr.orders.netIncomeDetail')}</div><div className="v" style={{ color: 'var(--success)' }}>{fmt(selected.provider_amount)}</div></div>
              <div className="detail-item"><div className="k">{t('pr.orders.createdAt')}</div><div className="v">{fmtDate(selected.created_at)}</div></div>
              {selected.accepted_at && <div className="detail-item"><div className="k">{t('pr.orders.acceptedAt')}</div><div className="v">{fmtDate(selected.accepted_at)}</div></div>}
              {selected.status === 'cancelled' && (
                <div className="detail-item" style={{ gridColumn: '1 / -1' }}>
                  <div className="k">{t('pr.orders.rejectReason')}</div>
                  <div className="v" style={{ color: 'var(--danger)' }}>{selected.reject_reason || t('pr.orders.noReason')}</div>
                </div>
              )}
            </div>

            {selected.items_json && (
              <div className="card mb-4">
                <div className="card-header"><h3>{t('pr.orders.itemsDetail')}</h3></div>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>{t('pr.orders.thItem')}</th><th>{t('pr.orders.thQty')}</th><th>{t('pr.orders.thUnitPrice')}</th><th>{t('pr.orders.thTotal')}</th></tr></thead>
                    <tbody>
                       {safeItems(selected.items_json).map((it: any, i: number) => (
                        <tr key={i}><td>{it.title}</td><td>{it.quantity}</td><td>{fmt(it.unit_price)}</td><td className="bold">{fmt(it.total)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {selected.notes && (
              <div className="card mb-4">
                <div className="card-header"><h3>{t('pr.orders.customerNotes')}</h3></div>
                <div className="card-body">{selected.notes}</div>
              </div>
            )}

            {selected.booking && (
              <div className="card mb-4">
                <div className="card-header"><h3>{t('pr.orders.bookingDetails')}</h3></div>
                <div className="detail-grid">
                  <div className="detail-item"><div className="k">{t('pr.orders.bookingDate')}</div><div className="v">{selected.booking.booking_date ? fmtDate(selected.booking.booking_date) : '-'}</div></div>
                  <div className="detail-item"><div className="k">{t('pr.orders.checkIn')}</div><div className="v">{selected.booking.check_in ? fmtDate(selected.booking.check_in) : '-'}</div></div>
                  <div className="detail-item"><div className="k">{t('pr.orders.checkOut')}</div><div className="v">{selected.booking.check_out ? fmtDate(selected.booking.check_out) : '-'}</div></div>
                  <div className="detail-item"><div className="k">{t('pr.orders.guestsSeats')}</div><div className="v">{selected.booking.guests || '-'}</div></div>
                  {selected.booking.travel_date && <div className="detail-item"><div className="k">{t('pr.orders.travelDate')}</div><div className="v">{fmtDate(selected.booking.travel_date)}</div></div>}
                  {selected.booking.passengers && <div className="detail-item"><div className="k">{t('pr.orders.passengers')}</div><div className="v">{selected.booking.passengers}</div></div>}
                  {selected.booking.nights && <div className="detail-item"><div className="k">{t('pr.orders.nights')}</div><div className="v">{selected.booking.nights}</div></div>}
                  {selected.booking.title && <div className="detail-item"><div className="k">{t('pr.orders.titleFlight')}</div><div className="v">{selected.booking.title}</div></div>}
                </div>
              </div>
            )}

            <div className="card">
              <div className="card-header"><h3>{t('pr.orders.statusTitle')}</h3></div>
              <div className="card-body flex wrap">
                {selected.status === 'pending' && (
                  <>
                    <button className="btn btn-success" disabled={saving} onClick={confirmOrder}>{t('pr.orders.acceptBtn')}</button>
                    <button className="btn btn-danger" disabled={saving} onClick={() => { setRejectReason(''); setRejectOpen(true); }}>{t('pr.orders.rejectBtn')}</button>
                    <span className="muted">{t('pr.orders.acceptHint')}</span>
                  </>
                )}
                {(NEXT_STATUS[selected.status] || []).filter((s) => s !== 'confirmed' && s !== 'cancelled').map((s) => (
                  <button key={s} className="btn btn-outline" disabled={saving} onClick={() => changeStatus(s)}>{t('pr.orders.transferTo')} {(ORDER_STATUS as Record<string, any>)[s].label}</button>
                ))}
                {selected.status !== 'pending' && (NEXT_STATUS[selected.status] || []).includes('cancelled') && (
                  <button className="btn btn-outline" disabled={saving} onClick={() => { setRejectReason(''); setRejectOpen(true); }}>{t('pr.orders.cancelBtn')}</button>
                )}
                {selected.status !== 'pending' && selected.status !== 'completed' && (NEXT_STATUS[selected.status] || []).length === 0 && (
                  <span className="muted">{t('pr.orders.noTransitions')}</span>
                )}
              </div>
            </div>

            <Modal open={rejectOpen} title={selected.status === 'pending' ? t('pr.orders.rejectModalTitle.pending') : t('pr.orders.rejectModalTitle.other')} onClose={() => setRejectOpen(false)}>
              <Field label={selected.status === 'pending' ? t('pr.orders.rejectReasonLabel.pending') : t('pr.orders.rejectReasonLabel.other')} required>
                <textarea rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder={t('pr.orders.rejectPlaceholder')} />
              </Field>
              {selected.status === 'pending' && <p className="muted">{t('pr.orders.rejectHint')}</p>}
              <div className="form-actions">
                <button className="btn btn-outline" onClick={() => setRejectOpen(false)}>{t('pr.orders.cancelReject')}</button>
                <button className="btn btn-danger" disabled={saving || !rejectReason.trim()} onClick={() => changeStatus('cancelled', rejectReason.trim())}>
                  {saving ? t('pr.orders.saving') : selected.status === 'pending' ? t('pr.orders.rejectAction.pending') : t('pr.orders.rejectAction.other')}
                </button>
              </div>
            </Modal>
          </>
        )}
      </Modal>
    </div>
  );
}
