import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { Badge, ORDER_STATUS } from '@rafidain/shared/ui';
import { Toast } from '../components/Toast';
import { CenterSpinner } from '../components/Spinner';
import { useCart } from '../context/CartContext';
import { useLocale, t } from '@rafidain/shared';
import { customerApi } from '../api';
import { formatPrice, formatDateTime } from '../format';
const UNIT: Record<string, string> = { products: 'item.unit.product', menu: 'item.unit.menu', packages: 'item.unit.package', rooms: 'item.unit.room', flights: 'item.unit.flight' };
const FLOW = [
  { key: 'pending', label: 'order.flow.pending' },
  { key: 'confirmed', label: 'order.flow.confirmed' },
  { key: 'in_progress', label: 'order.flow.in_progress' },
  { key: 'completed', label: 'order.flow.completed' },
];

function OrderTimeline({ status, createdAt, history }: { status: string; createdAt: string; history?: any[] }) {
  useLocale();
  const idx = FLOW.findIndex((s) => s.key === status);
  const at = (key: string) => {
    if (key === 'pending') return createdAt;
    const hit = (history || []).find((h: any) => h.status === key);
    return hit ? hit.at : null;
  };
  return (
    <div className="timeline">
      {FLOW.map((step, i) => {
        const done = idx > i;
        const current = idx === i;
        const reached = idx >= i || (history || []).some((h: any) => h.status === step.key);
        const date = at(step.key);
        const actor = (history || []).find((h: any) => h.status === step.key);
        return (
          <div className="timeline__row" key={step.key}>
            <div className="timeline__rail">
              <span className={`timeline__dot${done ? ' timeline__dot--done' : ''}${current ? ' timeline__dot--current' : ''}`} />
              {i < FLOW.length - 1 && <span className={`timeline__line${done ? ' timeline__line--done' : ''}`} />}
            </div>
            <div className="timeline__body">
              <div className={`timeline__label${done ? ' timeline__label--done' : ''}${current ? ' timeline__label--current' : ''}`}>
                {t(step.label)}
                {current && <span className="muted" style={{ marginRight: 6 }}>{t('order.currentStatus')}</span>}
              </div>
              {date && (
                <div className="timeline__date">
                  {formatDateTime(date)}
                  {actor?.note ? ` — ${actor.note}` : ''}
                  {actor?.by_name ? ` (${actor.by_name})` : ''}
                </div>
              )}
              {!date && i === 0 && <div className="timeline__date">{formatDateTime(createdAt)}</div>}
              {!reached && !date && <div className="timeline__date" />}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function OrderDetail() {
  useLocale();
  const { id } = useParams();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const [order, setOrder] = useState<any>(null);
  const [rateInfo, setRateInfo] = useState<any>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [invoiceData, setInvoiceData] = useState<any>(null);

  useEffect(() => {
    customerApi
      .order(id || '')
      .then((o) => {
        setOrder(o);
        if (o.status === 'completed') {
          return customerApi.rateInfo(o.provider_id).then((r) => {
            setRateInfo(r);
            if (r.my_rating) setRating(r.my_rating);
          });
        }
        return null;
      })
      .catch(() => setOrder(null));
  }, [id]);

  if (!order) {
    return (
      <div>
        <PageHeader title={t('order.title')} />
        <CenterSpinner />
      </div>
    );
  }

  const items = (() => {
    try {
      return JSON.parse(order.items_json || '[]');
    } catch (e: any) {
      return [];
    }
  })();

  const submitRating = async () => {
    if (rating < 1) {
      setToast(t('reviews.rateError'));
      return;
    }
    try {
      await customerApi.rate(order.provider_id, rating, comment || undefined);
      setToast(t('reviews.thanks'));
    } catch (e: any) {
      setToast(e.message);
    }
  };

  const reorder = () => {
    const addable = items.filter((it: any) => it && it.item_id !== undefined && ['products', 'menu', 'packages'].includes(it.kind));
    if (!addable.length) {
      setToast(t('order.reorderBlocked'));
      return;
    }
    for (const it of addable) {
      addItem({
        provider_id: order.provider_id,
        provider_name: order.provider_name,
        kind: it.kind,
        item_id: it.item_id,
        title: it.title,
        unit_price: Number(it.unit_price) || 0,
        quantity: Number(it.quantity) || 1,
        unit: t(UNIT[it.kind] || 'order.unit'),
      });
    }
    setToast(t('order.reorderAdded', { count: addable.length }));
    navigate('/cart');
  };

  const canDispute = ['completed', 'cancelled'].includes(order?.status);
  const submitDispute = async () => {
    if (!disputeReason.trim()) {
      setToast(t('dispute.reasonRequired'));
      return;
    }
    setBusy(true);
    try {
      await customerApi.openDispute(order.id, disputeReason.trim());
      setToast(t('dispute.opened'));
      setDisputeOpen(false);
      setDisputeReason('');
    } catch (err: any) {
      setToast(err.message);
    } finally {
      setBusy(false);
    }
  };
  const viewInvoice = async () => {
    setBusy(true);
    try {
      const inv = await customerApi.invoice(order.id);
      setInvoiceData(inv);
    } catch (err: any) {
      setToast(err.message);
    } finally {
      setBusy(false);
    }
  };

  const canCancel = ['pending', 'confirmed'].includes(order?.status);
  const cancelOrder = async () => {
    if (!canCancel) return;
    if (!window.confirm(t('order.cancelConfirm'))) return;
    setBusy(true);
    setToast('');
    try {
      const updated: any = await customerApi.cancelOrder(order.id);
      if (updated && updated.id) setOrder(updated);
      else {
        setToast(t('order.cancelledToast'));
        customerApi.order(order.id).then(setOrder).catch(() => {});
      }
    } catch (err: any) {
      setToast(err.message || t('order.cancelFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader title={order.order_number} />
      <div className="page page--no-nav">
        <div className="card" style={{ padding: 14 }}>
          <div className="row row--between">
            <span className="detail-title">{order.provider_name}</span>
            <Badge status={order.status} map={ORDER_STATUS} />
          </div>
          <div className="muted" style={{ marginTop: 4 }}>{order.service_name_ar}</div>
          {order.customer_name && <div className="muted" style={{ marginTop: 2 }}>{t('order.customer', { name: order.customer_name, phone: order.customer_phone })}</div>}
          {order.provider_phone && (
            <div style={{ marginTop: 8, padding: 12, borderRadius: 12, background: 'var(--surface2)', border: '1px solid var(--border2)' }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{t('order.contactProvider')}</div>
              <div className="muted" style={{ marginTop: 4 }}>{t('order.contactPhoneHint')}</div>
              <a className="detail-title" style={{ color: 'var(--brand)', direction: 'ltr', display: 'inline-block' }} href={`tel:${order.provider_phone}`}>{order.provider_phone}</a>
            </div>
          )}
          {order.discount_amount > 0 && (
            <div className="summary-row" style={{ marginTop: 6 }}>
              <span>{t('order.discountLine', { code: order.coupon_code })}</span>
              <span style={{ color: '#00a650', fontWeight: 700 }}>-{formatPrice(order.discount_amount)}</span>
            </div>
          )}
          {order.points_discount_amount > 0 && (
            <div className="summary-row">
              <span>{t('order.pointsDiscount', { count: order.redeemed_points })}</span>
              <span style={{ color: '#00a650', fontWeight: 700 }}>-{formatPrice(order.points_discount_amount)}</span>
            </div>
          )}
          <div className="summary-row--total summary-row" style={{ marginTop: 8 }}>
            <span>{t('order.total')}</span>
            <span>{formatPrice(order.total_amount)}</span>
          </div>
          <div className="muted" style={{ marginTop: 2 }}>{t('order.date', { date: formatDateTime(order.created_at) })}</div>
          {(order.status !== 'cancelled' || true) && (
            <div className="row" style={{ gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              {order.status !== 'cancelled' && (
                <button className="btn btn--outline btn--sm" onClick={reorder} type="button">
                  {t('order.reorder')}
                </button>
              )}
              <button className="btn btn--outline btn--sm" onClick={viewInvoice} disabled={busy} type="button">
                {t('invoice.view')}
              </button>
              {canDispute && (
                <button className="btn btn--outline btn--sm" onClick={() => setDisputeOpen((v) => !v)} type="button">
                  {t('dispute.open')}
                </button>
              )}
            </div>
          )}
          {disputeOpen && (
            <div className="card" style={{ marginTop: 10, padding: 14 }}>
              <div className="detail-title">{t('dispute.title')}</div>
              <textarea
                className="input"
                rows={3}
                style={{ marginTop: 8 }}
                placeholder={t('dispute.reasonPlaceholder')}
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
              />
              <div className="row" style={{ gap: 8, marginTop: 10 }}>
                <button className="btn btn--primary btn--sm" onClick={submitDispute} disabled={busy} type="button">
                  {busy ? t('dispute.submitting') : t('dispute.submit')}
                </button>
                <button className="btn btn--outline btn--sm" onClick={() => setDisputeOpen(false)} type="button">
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          )}
          {invoiceData && (
            <div className="card" style={{ marginTop: 10, padding: 14 }}>
              <div className="detail-title">{t('invoice.title')} — {invoiceData.invoice.number}</div>
              <div className="muted" style={{ marginTop: 4 }}>{t('invoice.currency')}: {invoiceData.invoice.currency}</div>
              {(invoiceData.items || []).map((it: any, i: number) => (
                <div key={i} className="summary-row">
                  <span className="grow">{it.title} × {it.quantity}</span>
                  <span>{formatPrice(it.total)}</span>
                </div>
              ))}
              <div className="summary-row"><span>{t('invoice.subtotal')}</span><span>{formatPrice(invoiceData.invoice.subtotal)}</span></div>
              {invoiceData.invoice.discount_amount > 0 && (
                <div className="summary-row"><span>{t('invoice.discount')}</span><span style={{ color: '#00a650' }}>-{formatPrice(invoiceData.invoice.discount_amount)}</span></div>
              )}
              {invoiceData.invoice.tax_amount > 0 && (
                <div className="summary-row"><span>{t('invoice.tax', { rate: invoiceData.invoice.tax_rate })}</span><span>{formatPrice(invoiceData.invoice.tax_amount)}</span></div>
              )}
              <div className="summary-row--total summary-row" style={{ marginTop: 6 }}><span>{t('invoice.total')}</span><span>{formatPrice(invoiceData.invoice.total)}</span></div>
            </div>
          )}
          {canCancel && (
            <button className="btn btn--danger btn--sm" style={{ marginTop: 8, marginLeft: 8 }} onClick={cancelOrder} disabled={busy} type="button">
              {busy ? t('order.cancelling') : t('order.cancel')}
            </button>
          )}
        </div>

        <div className="section-title">{t('order.statusTitle')}</div>
        <div className="card" style={{ padding: 14 }}>
          {order.status === 'cancelled' ? (
            <div style={{ padding: 10, borderRadius: 12, background: 'var(--danger-bg)', color: 'var(--danger-text)', fontWeight: 700 }}>
              ❌ {t('order.cancelled')}{order.reject_reason ? `: ${order.reject_reason}` : ''}
            </div>
          ) : (
            <OrderTimeline status={order.status} createdAt={order.created_at} history={order.history} />
          )}
        </div>

        {order.status === 'confirmed' && (
          <div style={{ marginTop: 10, padding: 12, borderRadius: 12, background: 'var(--success-bg)', color: 'var(--success-text)', fontWeight: 700 }}>
            {t('order.confirmedNote')}
          </div>
        )}

        <div className="section-title">{t('order.itemsTitle')}</div>
        <div className="card" style={{ padding: '4px 14px' }}>
          {items.map((it: any, i: number) => (
            <div key={i} className="summary-row">
              <span className="grow">{it.title} × {it.quantity}</span>
              <span>{formatPrice(it.total)}</span>
            </div>
          ))}
        </div>

        {order.booking && (
          <>
            <div className="section-title">{t('order.bookingTitle')}</div>
            <div className="card" style={{ padding: 14 }}>
              {order.booking.type && <div className="muted">{t('order.bookingType', { value: order.booking.type })}</div>}
              {order.booking.title && <div className="muted">{t('order.bookingItem', { value: order.booking.title })}</div>}
              {order.booking.check_in && <div className="muted">{t('order.bookingCheckIn', { value: order.booking.check_in })}</div>}
              {order.booking.check_out && <div className="muted">{t('order.bookingCheckOut', { value: order.booking.check_out })}</div>}
              {order.booking.guests && <div className="muted">{t('order.bookingGuests', { value: order.booking.guests })}</div>}
              {order.booking.travel_date && <div className="muted">{t('order.bookingTravelDate', { value: order.booking.travel_date })}</div>}
              {order.booking.passengers && <div className="muted">{t('order.bookingPassengers', { value: order.booking.passengers })}</div>}
            </div>
          </>
        )}

        {order.status === 'completed' && rateInfo && (
          <>
            <div className="section-title">{t('order.rateProvider')}</div>
            <div className="card" style={{ padding: 14 }}>
              <div className="row" style={{ gap: 6, marginBottom: 10 }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} style={{ fontSize: 30, color: n <= rating ? '#ffb400' : 'var(--border2)' }} onClick={() => setRating(n)} type="button">
                    ★
                  </button>
                ))}
              </div>
              <textarea className="input" placeholder={t('reviews.commentPlaceholder')} value={comment} onChange={(e) => setComment(e.target.value)} />
              <button className="btn btn--primary" style={{ marginTop: 10 }} onClick={submitRating} type="button">{t('reviews.submit')}</button>
            </div>
          </>
        )}
      </div>
      <Toast message={toast} onClose={() => setToast('')} />
    </div>
  );
}
