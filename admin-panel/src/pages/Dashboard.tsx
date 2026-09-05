import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useToast, fmt, StatCard, PageLoading, Badge, ORDER_STATUS } from '@rafidain/shared/ui';
import { PageHead } from '@rafidain/shared/ui';
import { t } from '@rafidain/shared/i18n';
import { useLocale } from '@rafidain/shared';

export default function Dashboard() {
  useLocale();
  const [data, setData] = useState<any>(null);
  const [promo, setPromo] = useState<any>(null);
  const toast = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/dashboard')
      .then((res) => setData(res.data))
      .catch((e) => toast.error(e.message));
    api.get('/promotions/all?limit=1')
      .then((res) => setPromo(res.meta || null))
      .catch(() => {});
  }, []);

  if (!data) return <PageLoading />;

  const c = data.counts;
  const r = data.revenue;
  const maxStatus = Math.max(1, ...data.orders_by_status.map((s: any) => s.count));
  const maxMonthly = Math.max(1, ...data.monthly.map((m: any) => m.orders_count));

  return (
    <div>
      <PageHead title={t('ad.dash.title')} subtitle={t('ad.dash.subtitle')} />

      <div className="grid grid-4 mb-4">
        <StatCard label={t('ad.dash.customers')} value={fmt(c.customers)} icon="👥" tone="info" />
        <StatCard label={t('ad.dash.agents')} value={fmt(c.agents)} icon="🤝" tone="primary" />
        <StatCard label={t('ad.dash.providers')} value={fmt(c.providers)} icon="🏪" tone="accent" />
        <StatCard label={t('ad.dash.governorates')} value={fmt(c.governorates)} icon="🏙️" tone="success" />
      </div>

      <div className="grid grid-3 mb-4">
        <StatCard label={t('ad.dash.ordersValue')} value={fmt(r.orders_value)} icon="🧾" tone="primary" />
        <StatCard label={t('ad.dash.platformRevenue')} value={fmt(r.platform_revenue)} icon="💰" tone="success" />
        <StatCard label={t('ad.dash.agentEarnings')} value={fmt(r.agent_revenue)} icon="🤝" tone="accent" />
      </div>

      <div className="grid grid-3 mb-4">
        <StatCard label={t('ad.dash.activeAds')} value={fmt(promo?.total_active ?? 0)} icon="📢" tone="success" />
        <StatCard label={t('ad.dash.activeAdRevenue')} value={`${fmt(promo?.active_revenue ?? 0)} ${t('ad.currency')}`} icon="💰" tone="accent" />
        <div className="card stat-card flex-between">
          <div>
            <div className="stat-label">{t('ad.dash.adsPromo')}</div>
            <div className="stat-value" style={{ fontSize: 14, color: 'var(--muted)', fontWeight: 600 }}>{fmt(promo?.total_impressions ?? 0)} {t('ad.dash.impressionsShort')} · {fmt(promo?.total_clicks ?? 0)} {t('ad.dash.clicksShort')} · CTR {promo?.total_ctr ?? 0}%</div>
          </div>
          <button className="btn btn-outline btn-sm" onClick={() => navigate('/promotions')}>{t('ad.dash.openSection')} ←</button>
        </div>
      </div>

      <div className="grid grid-2 mb-4">
        <div className="card">
          <div className="card-header">
            <h3>{t('ad.dash.ordersByStatus')}</h3>
            <span className="badge badge-gray">{t('ad.dash.total')}: {fmt(r.orders_count)}</span>
          </div>
          <div className="card-body">
            {data.orders_by_status.length === 0 && <div className="muted">{t('ad.dash.noOrdersYet')}</div>}
            {data.orders_by_status.map((s: any) => (
              <div className="bar-row" key={s.status}>
                <span className="bar-label"><Badge status={s.status} map={ORDER_STATUS} /></span>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${(s.count / maxStatus) * 100}%` }} />
                </div>
                <span className="bar-value">{fmt(s.count)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>{t('ad.dash.providersByService')}</h3>
            <span className="badge badge-gray">{t('ad.dash.active')}: {fmt(c.active_providers)}</span>
          </div>
          <div className="card-body">
            {data.providers_by_service.map((s: any) => (
              <div className="flex-between" key={s.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <div className="flex">
                  <span style={{ fontSize: 18 }}>{s.icon}</span>
                  <button className="link-btn" onClick={() => navigate(`/providers?service_slug=${s.slug}`)}>{s.name_ar}</button>
                  <span className="muted mono">({s.slug})</span>
                </div>
                <div className="flex">
                  <span className="badge badge-teal">{fmt(s.providers_count)} {t('ad.dash.provider')}</span>
                  <span className="badge badge-gray">{fmt(s.orders_count)} {t('ad.dash.orderItem')}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid mb-4">
        <div className="card">
          <div className="card-header">
            <h3>{t('ad.dash.governoratesAgents')}</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/agents')}>{t('ad.dash.manageAgents')} ←</button>
          </div>
          <div className="card-body">
            {data.providers_by_governorate.map((g: any) => (
              <div className="flex-between" key={g.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                <div className="flex" style={{ gap: 8, flexWrap: 'wrap' }}>
                  <button className="link-btn" onClick={() => navigate(`/providers?governorate_id=${g.id}`)}>{g.name_ar}</button>
                  <span className="muted mono">({g.code})</span>
                  <span className="muted" style={{ fontSize: 12 }}>{t('ad.dash.agent')}: {g.agent_name || '—'}</span>
                </div>
                <div className="flex">
                  <span className="badge badge-teal">{fmt(g.providers_count)} {t('ad.dash.provider')}</span>
                  <span className="badge badge-gray">{fmt(g.orders_count)} {t('ad.dash.orderItem')}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-2 mb-4">
        <div className="card">
          <div className="card-header">
            <h3>{t('ad.dash.monthlyOrders')}</h3>
          </div>
          <div className="card-body">
            {data.monthly.map((m: any) => (
              <div className="bar-row" key={m.month}>
                <span className="bar-label mono">{m.month}</span>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${(m.orders_count / maxMonthly) * 100}%` }} />
                </div>
                <span className="bar-value">{fmt(m.orders_count)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>{t('ad.dash.keyIndicators')}</h3>
          </div>
          <div className="card-body">
            <div className="detail-grid">
              <div className="detail-item"><div className="k">{t('ad.dash.activeAgents')}</div><div className="v">{fmt(c.active_agents)}</div></div>
              <div className="detail-item"><div className="k">{t('ad.dash.verifiedProviders')}</div><div className="v">{fmt(c.verified_providers)}</div></div>
              <div className="detail-item"><div className="k">{t('ad.dash.activeProviders')}</div><div className="v">{fmt(c.active_providers)}</div></div>
              <div className="detail-item"><div className="k">{t('ad.dash.pendingLeaseRenewals')}</div><div className="v">{fmt(c.pending_lease_requests)}</div></div>
            </div>
            <div className="alert-info mt-4" style={{ marginBottom: 0 }}>
              💡 {t('ad.dash.platformNote')}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
