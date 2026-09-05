import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useToast, fmt, fmtDate, PageLoading, EmptyState, Badge, ORDER_STATUS } from '@rafidain/shared/ui';
import type { ProviderOverview } from '../types';
import { t } from '@rafidain/shared/i18n';
import { useLocale } from '@rafidain/shared';

const TXN_TYPES = {
  commission: { label: 'ag.providers.txnCommission', cls: 'badge-red' },
  refund: { label: 'ag.providers.txnRefund', cls: 'badge-amber' },
  recharge: { label: 'ag.providers.txnRecharge', cls: 'badge-green' },
  promotion: { label: 'ag.providers.txnPromotion', cls: 'badge-blue' },
  withdrawal: { label: 'ag.providers.txnWithdrawal', cls: 'badge-gray' },
};

function Stars({ value, count }: { value: number; count: number }) {
  const v = Number(value) || 0;
  const full = Math.round(v);
  return (
    <span>
      <span className="rating-stars">{'★'.repeat(full)}{'☆'.repeat(Math.max(0, 5 - full))}</span>{' '}
      {v > 0 ? <span className="bold">{v.toFixed(1)}</span> : <span className="muted">{t('ag.providers.noRating')}</span>}
      {count > 0 && <span className="rating-num"> ({t('ag.providers.reviewCount', { count: fmt(count) })})</span>}
    </span>
  );
}

const SVC_COLORS = ['#0f766e', '#2563eb', '#d97706', '#16a34a', '#7c3aed', '#dc2626', '#0891b2', '#65a30d'];

export default function ProviderDetail() {
  useLocale();
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [data, setData] = useState<ProviderOverview | null>(null);

  useEffect(() => {
    api.get(`/providers/${id}/overview`)
      .then((r) => setData(r.data))
      .catch((e) => { toast.error(e.message); navigate('/providers'); });
  }, [id]);

  if (!data) return <PageLoading />;
  const p = data.provider;
  const catalog = data.catalog || {};
  const maxOrders = Math.max(1, ...data.monthly.map((m) => m.orders_count));
  const maxStatus = Math.max(1, ...data.orders_by_status.map((s) => s.count));

  return (
    <div>
      <div className="subhead">
        <button className="back" onClick={() => navigate('/providers')}>{t('ag.providers.backToProviders')}</button>
      </div>

      <div className="card mb-4">
        <div className="card-body" style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="avatar-lg">{p.service_icon || '🏪'}</div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <h2 style={{ margin: 0, fontSize: 20 }}>{p.name_ar}</h2>
            <div className="muted" style={{ fontSize: 13 }}>{p.email} • {p.phone || ''}</div>
            <div className="flex wrap mt-1" style={{ gap: 8 }}>
              <Badge status={p.verification_status || 'none'} map={{ approved: { label: 'ag.providers.verifiedBadge', cls: 'badge-green' }, pending: { label: 'ag.providers.pendingBadge', cls: 'badge-amber' }, rejected: { label: 'ag.providers.rejectedBadge', cls: 'badge-red' }, none: { label: 'ag.providers.noneBadge', cls: 'badge-gray' } }} />
              <span className="badge badge-blue">{p.service_icon} {p.service_name_ar}</span>
              <span className={`badge ${p.is_active ? 'badge-green' : 'badge-red'}`}>{p.is_active ? t('ag.providers.activeBadge') : t('ag.providers.inactiveBadge')}</span>
            </div>
            <div className="mt-1"><Stars value={data.rating || 0} count={data.rating_count || 0} /></div>
          </div>
          <div style={{ textAlign: 'left' }}>
            <div className="kpi__label">{t('ag.providers.walletBalance')}</div>
            <div className="kpi__value">{fmt(data.wallet?.balance || 0)} <span className="muted" style={{ fontSize: 12 }}>{t('ag.providers.dinar')}</span></div>
            <div className="kpi__label mt-1">{t('ag.providers.platformCommission')}</div>
            <div className="kpi__value">%{p.commission_rate}</div>
          </div>
        </div>
      </div>

      <div className="kpi-row mb-4">
        <div className="kpi"><div className="kpi__label">{t('ag.providers.totalOrders')}</div><div className="kpi__value">{fmt(p.orders_count)}</div></div>
        <div className="kpi"><div className="kpi__label">{t('ag.providers.ordersValue')}</div><div className="kpi__value">{fmt(p.total_value)}</div></div>
        <div className="kpi"><div className="kpi__label">{t('ag.providers.city')}</div><div className="kpi__value" style={{ fontSize: 14 }}>{p.governorate_name_ar}</div></div>
        <div className="kpi"><div className="kpi__label">{t('ag.providers.joinDate')}</div><div className="kpi__value" style={{ fontSize: 14 }}>{fmtDate(p.created_at)}</div></div>
      </div>

      <div className="grid grid-2 mb-4">
        <div className="card">
          <div className="card-header"><h3>{t('ag.providers.ordersByStatus')}</h3></div>
          <div className="card-body">
            {data.orders_by_status.length === 0 && <div className="muted">{t('ag.providers.noOrders')}</div>}
            {data.orders_by_status.map((s) => (
              <div className="bar-row" key={s.status}>
                <span className="bar-label"><Badge status={s.status} map={ORDER_STATUS} /></span>
                <div className="bar-track"><div className="bar-fill" style={{ width: `${(s.count / maxStatus) * 100}%` }} /></div>
                <span className="bar-value">{fmt(s.count)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3>{t('ag.providers.catalogTitle')}</h3></div>
          <div className="card-body">
            {Object.keys(catalog).length === 0 ? <div className="muted">{t('ag.providers.noCatalog')}</div> : (
              Object.keys(catalog).map((k) => (
                <div className="flex-between" key={k} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <span className="bold">{k}</span>
                  <span className="badge badge-teal">{fmt(catalog[k])}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="card mb-4">
        <div className="card-header"><h3>{t('ag.providers.activityTitle')}</h3></div>
        <div className="card-body">
          {data.monthly.length === 0 ? <div className="muted">{t('ag.providers.noActivityData')}</div> : (
            data.monthly.map((m) => (
              <div className="bar-row" key={m.month}>
                <span className="bar-label mono">{m.month}</span>
                <div className="bar-track"><div className="bar-fill" style={{ width: `${(m.orders_count / maxOrders) * 100}%` }} /></div>
                <span className="bar-value">{fmt(m.orders_count)} {t('ag.providers.order')}</span>
                <span className="muted" style={{ fontSize: 12, width: 130, textAlign: 'left' }}>{fmt(m.total_value)} {t('ag.providers.dinar')} • {t('ag.providers.commissionLabel')} {fmt(m.commission)}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="grid grid-2 mb-4">
        <div className="card">
          <div className="card-header"><h3>{t('ag.providers.recentOrders')}</h3></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>{t('ag.providers.th.order')}</th><th>{t('ag.providers.th.customer')}</th><th>{t('ag.providers.th.amount')}</th><th>{t('ag.dash.status')}</th><th>{t('ag.providers.th.date')}</th></tr></thead>
              <tbody>
                {data.recent_orders.length === 0 && <tr><td colSpan={5}><div className="muted" style={{ padding: 16 }}>{t('ag.providers.noOrders')}</div></td></tr>}
                {data.recent_orders.map((o, i) => (
                  <tr key={`${o.order_number}-${i}`}>
                    <td><span className="mono">{o.order_number}</span></td>
                    <td>{o.customer_name || o.customer || '-'}</td>
                    <td>{fmt(o.total_amount)}</td>
                    <td><Badge status={o.status} map={ORDER_STATUS} /></td>
                    <td className="muted">{fmtDate(o.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3>{t('ag.providers.recentTxns')}</h3></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>{t('ag.providers.th.type')}</th><th>{t('ag.providers.th.amount')}</th><th>{t('ag.providers.th.balanceAfter')}</th><th>{t('ag.providers.th.reason')}</th></tr></thead>
              <tbody>
                {data.transactions.length === 0 && <tr><td colSpan={4}><div className="muted" style={{ padding: 16 }}>{t('ag.providers.noTxns')}</div></td></tr>}
                {data.transactions.map((trx) => (
                  <tr key={trx.id}>
                    <td><Badge status={trx.type} map={TXN_TYPES} /></td>
                    <td className={`bold ${trx.amount < 0 ? 'rating-low' : ''}`}>{fmt(trx.amount)}</td>
                    <td>{fmt(trx.balance_after)}</td>
                    <td className="muted" style={{ fontSize: 12 }}>{trx.note || (trx.order_number ? t('ag.providers.orderLabel', { number: trx.order_number }) : '-')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card mb-4">
        <div className="card-header"><h3>{t('ag.providers.reviewsTitle', { count: fmt(data.rating_count) })}</h3></div>
        <div className="card-body">
          {data.reviews.length === 0 ? <EmptyState text={t('ag.providers.noReviews')} icon="⭐" /> : (
            data.reviews.map((r, i) => (
              <div className="review-row" key={i}>
                <div className="review-row__head">
                  <span className="rating-stars">{'★'.repeat(r.rating)}{'☆'.repeat(Math.max(0, 5 - r.rating))}</span>
                  <span className="bold">{r.customer_name || t('ag.providers.customerFallback')}</span>
                  <span className="muted">• {fmtDate(r.created_at)}</span>
                </div>
                {r.comment && <div className="review-row__text">{r.comment}</div>}
                {r.reply && <div className="review-row__reply">{t('ag.providers.providerReply')}: {r.reply}</div>}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
