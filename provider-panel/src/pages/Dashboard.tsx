import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useToast, fmt, fmtDate, StatCard, PageLoading, Badge, ORDER_STATUS } from '@rafidain/shared/ui';
import { CATALOGS } from '../catalog';
import { PageHead } from '@rafidain/shared/ui';
import { t } from '@rafidain/shared/i18n';
import { useLocale } from '@rafidain/shared';

function renderTypeAlert(data: any, p: any, go: (to: string) => void) {
  const ta = data.type_alerts || {};
  switch (p.service_slug) {
    case 'stores': {
      const out = ta.out_of_stock || 0;
      const low = ta.low_stock || 0;
      if (!out && !low) return null;
      return (
        <div className="alert-warning mb-4">⚠️ <strong>{out}</strong>{t('pr.dash.stockOut')}<strong>{low}</strong>{t('pr.dash.stockLow')}
          <button className="btn btn-outline btn-sm" style={{ marginInlineStart: 8 }} onClick={() => go('/catalog')}>{t('pr.dash.manageStock')}</button>
        </div>
      );
    }
    case 'restaurants': {
      if (!ta.unavailable) return null;
      return (
        <div className="alert-warning mb-4">⚠️ {t('pr.dash.unavailableItems', { count: ta.unavailable })}
          <button className="btn btn-outline btn-sm" style={{ marginInlineStart: 8 }} onClick={() => go('/catalog')}>{t('pr.dash.manageMenu')}</button>
        </div>
      );
    }
    case 'hotels':
    case 'flights':
    case 'travel_offices': {
      if (!ta.upcoming) return null;
      const labelKey = p.service_slug === 'hotels' ? 'pr.dash.upcomingLabel.hotel' : p.service_slug === 'flights' ? 'pr.dash.upcomingLabel.flight' : 'pr.dash.upcomingLabel.travel';
      const icon = p.service_slug === 'hotels' ? '🛎️' : p.service_slug === 'flights' ? '✈️' : '🧳';
      return (
        <div className="alert-info mb-4">{icon} {t('pr.orders.customerHidden')} <strong>{ta.upcoming}</strong> {t(labelKey)}{t('pr.dash.upcomingNote')}
          <button className="btn btn-outline btn-sm" style={{ marginInlineStart: 8 }} onClick={() => go('/bookings')}>{t('pr.dash.viewBookings')}</button>
        </div>
      );
    }
    default:
      return null;
  }
}

export default function Dashboard() {
  const [data, setData] = useState<any>(null);
  const toast = useToast();
  const navigate = useNavigate();
  const go = (to: string) => navigate(to);
  useLocale();

  useEffect(() => {
    api.get('/provider/dashboard').then((r) => setData(r.data)).catch((e) => toast.error(e.message));
  }, []);

  if (!data) return <PageLoading />;

  const p = data.provider;
  const cat = (CATALOGS as Record<string, any>)[p.service_slug];
  const maxStatus = Math.max(1, ...data.orders_by_status.map((s: any) => s.count));
  const maxMonth = Math.max(1, ...data.monthly.map((m: any) => Number(m.revenue)));

  return (
    <div>
      <PageHead title={t('pr.dash.title', { name: p.name_ar })} subtitle={t('pr.dash.subtitle', { title: t(cat?.title || ''), gov: p.governorate_name_ar })} />

      {!p.is_verified && (
        <div className="alert-warning mb-4">
          <strong>{t('pr.dash.verifyRequired')}</strong> {t('pr.dash.verifyHint')}
          <button className="btn btn-primary btn-sm" style={{ marginInlineStart: 8 }} onClick={() => go('/profile')}>{t('pr.dash.verifyCta')}</button>
        </div>
      )}

      {renderTypeAlert(data, p, go)}

      <div className="card mb-4">
        <div className="card-header"><h3>{t('pr.dash.quickActions')}</h3></div>
        <div className="card-body">
          <div className="flex wrap" style={{ gap: 8 }}>
            <button className="btn btn-outline btn-sm" onClick={() => go('/catalog')}>{t('pr.dash.addItem', { item: t(cat?.item || 'prcat.fallback.item') })}</button>
            <button className="btn btn-outline btn-sm" onClick={() => go('/offers')}>🏷️ {t('pr.dash.featuredOffers')}</button>
            <button className="btn btn-outline btn-sm" onClick={() => go('/promotions')}>📢 {t('pr.dash.promote')}</button>
            {['hotels', 'flights', 'travel_offices'].includes(p.service_slug) && (
              <button className="btn btn-outline btn-sm" onClick={() => go('/bookings')}>📅 {t('pr.dash.bookings')}</button>
            )}
            <button className="btn btn-outline btn-sm" onClick={() => go('/wallet')}>👛 {t('pr.dash.myWallet')}</button>
          </div>
        </div>
      </div>

      <div className="grid grid-4 mb-4">
        <StatCard label={t(cat?.title || 'prcat.fallback.index')} value={fmt(data.catalog_count)} icon={cat?.icon || '📦'} tone="primary" />
        <StatCard label={t('pr.dash.ordersByStatus')} value={fmt(data.orders_count)} icon="🧾" tone="info" />
        <StatCard label={t('pr.dash.thAmount')} value={fmt(data.orders_value)} icon="💵" tone="primary" />
        <StatCard label={t('pr.dash.thNetIncome')} value={fmt(data.revenue)} icon="💰" tone="success" />
      </div>

      <div className="card mb-4">
        <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <h3>{t('pr.dash.promoTitle')}</h3>
          <button className="btn btn-outline btn-sm" onClick={() => go('/promotions')}>{t('pr.dash.managePromos')}</button>
        </div>
        <div className="card-body">
          {data.promotions.active_count === 0 ? (
            <div className="muted">{t('pr.dash.noPromos', { gov: p.governorate_name_ar })}</div>
          ) : (
            <div className="grid grid-4">
              <div className="stat-mini"><span className="stat-mini__label">{t('pr.dash.activePromos')}</span><span className="stat-mini__value">{fmt(data.promotions.active_count)}</span></div>
              <div className="stat-mini"><span className="stat-mini__label">{t('pr.dash.impressions')}</span><span className="stat-mini__value">{fmt(data.promotions.impressions)}</span></div>
              <div className="stat-mini"><span className="stat-mini__label">{t('pr.dash.clicks')}</span><span className="stat-mini__value">{fmt(data.promotions.clicks)}</span></div>
              <div className="stat-mini"><span className="stat-mini__label">{t('pr.dash.ctr')}</span><span className="stat-mini__value">%{data.promotions.ctr}</span></div>
            </div>
          )}
        </div>
      </div>

      <div className="card mb-4">
        <div className="card-body">
          <div className="detail-grid">
            <div className="detail-item"><div className="k">{t('pr.dash.detailName')}</div><div className="v">{p.name_ar}</div></div>
            <div className="detail-item"><div className="k">{t('pr.dash.detailType')}</div><div className="v"><span className="badge badge-blue">{cat?.icon} {t(cat?.title || '')}</span></div></div>
            <div className="detail-item"><div className="k">{t('pr.dash.detailGov')}</div><div className="v"><span className="badge badge-teal">{p.governorate_name_ar}</span></div></div>
            <div className="detail-item"><div className="k">{t('pr.dash.detailCommission')}</div><div className="v">%{p.commission_rate}</div></div>
            <div className="detail-item"><div className="k">{t('pr.dash.detailVerified')}</div><div className="v"><Badge status={p.is_verified ? 'verified' : 'not'} map={{ verified: { label: t('pr.dash.verifiedBadge'), cls: 'badge-green' }, not: { label: t('pr.dash.unverifiedBadge'), cls: 'badge-gray' } }} /></div></div>
            <div className="detail-item"><div className="k">{t('pr.dash.detailRating')}</div><div className="v">{p.rating} / 5 <span className="muted">({p.rating_count} {t('pr.dash.ratingCount')})</span></div></div>
          </div>
        </div>
      </div>

      <div className="grid grid-2 mb-4">
        <div className="card">
          <div className="card-header"><h3>{t('pr.dash.ordersByStatus')}</h3></div>
          <div className="card-body">
            {data.orders_by_status.length === 0 && <div className="muted">{t('pr.dash.noOrdersYet')}</div>}
            {data.orders_by_status.map((s: any) => (
              <div className="bar-row" key={s.status}>
                <span className="bar-label"><Badge status={s.status} map={ORDER_STATUS} /></span>
                <div className="bar-track"><div className="bar-fill" style={{ width: `${(s.count / maxStatus) * 100}%` }} /></div>
                <span className="bar-value">{fmt(s.count)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3>{t('pr.dash.monthlyRevenue')}</h3></div>
          <div className="card-body">
            {data.monthly.length === 0 && <div className="muted">{t('pr.dash.noDataYet')}</div>}
            {data.monthly.map((m: any) => (
              <div className="bar-row" key={m.month}>
                <span className="bar-label muted">{m.month}</span>
                <div className="bar-track"><div className="bar-fill" style={{ width: `${(Number(m.revenue) / maxMonth) * 100}%`, background: 'var(--success)' }} /></div>
                <span className="bar-value">{fmt(m.revenue)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><h3>{t('pr.dash.latestOrders')}</h3></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>{t('pr.dash.thOrder')}</th><th>{t('pr.dash.thCustomer')}</th><th>{t('pr.dash.thAmount')}</th><th>{t('pr.dash.thNetIncome')}</th><th>{t('pr.dash.thStatus')}</th><th>{t('pr.dash.thDate')}</th></tr></thead>
            <tbody>
              {data.recent_orders.length === 0 && <tr><td colSpan={6}><div className="muted" style={{ padding: 16 }}>{t('pr.dash.emptyOrders')}</div></td></tr>}
               {data.recent_orders.map((o: any) => (
                <tr key={o.id}>
                  <td><span className="mono">{o.order_number}</span></td>
                  <td>{o.customer_name || '-'}</td>
                  <td>{fmt(o.total_amount)}</td>
                  <td className="bold" style={{ color: 'var(--success)' }}>{fmt(o.provider_amount)}</td>
                  <td><Badge status={o.status} map={ORDER_STATUS} /></td>
                  <td className="muted">{fmtDate(o.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
