import { useEffect, useState } from 'react';
import { api } from '../api';
import { useToast, fmt, PageLoading, KPICardWithTrend, StatCard, ORDER_STATUS, Badge } from '@rafidain/shared/ui';
import { PageHead } from '@rafidain/shared/ui';
import { t } from '@rafidain/shared/i18n';
import { useLocale } from '@rafidain/shared';

interface Kpi {
  label: string;
  current: number;
  previous: number;
  deltaPct: number;
  value?: number;
}

interface ExecutiveData {
  period: string;
  currentRange: { start: string; end: string };
  previousRange: { start: string; end: string };
  kpis: {
    orders: Kpi;
    customers: Kpi;
    revenue: Kpi;
    conversion: Kpi;
  };
  sparkline: { label: string; orders: number; revenue: number }[];
  averages: { aov: number; aovPrevious: number };
  statusBreakdown: { status: string; count: number; revenue: number }[];
  topProvinces: { id: number; name: string; orders: number; revenue: number }[];
  topProviders: { id: number; name: string; orders: number; revenue: number }[];
  attention: { pendingProviders: number; pendingAgentWithdrawals: number };
}

const STATUS_COLOR: Record<string, string> = {
  pending: '#f59e0b',
  confirmed: '#3b82f6',
  completed: '#16a34a',
  cancelled: '#ef4444',
};

function rankMax(items: { orders: number }[]) {
  return Math.max(1, ...items.map((i) => i.orders));
}

function RankBar({ label, value, sub, max, tone }: { label: string; value: number; sub?: string; max: number; tone?: string }) {
  const pct = max > 0 ? Math.max(3, (value / max) * 100) : 0;
  return (
    <div className="bar-row">
      <div className="bar-label" title={label} style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
      <div className="bar-track">
        <div className="bar-fill" style={{ width: pct + '%', background: tone || 'var(--primary)' }} />
      </div>
      <div className="bar-value">{fmt(value)}{sub ? ` · ${sub}` : ''}</div>
    </div>
  );
}

export default function ExecutiveDashboard() {
  useLocale();
  const [data, setData] = useState<ExecutiveData | null>(null);
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('month');
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const PERIODS = [
    { value: 'day', label: t('ad.exec.dayly') },
    { value: 'week', label: t('ad.exec.weekly') },
    { value: 'month', label: t('ad.exec.monthly') },
  ] as const;

  const load = () => {
    setLoading(true);
    api.get(`/dashboard/executive?period=${period}`)
      .then((res) => { setData(res.data); setLoading(false); })
      .catch((e) => { toast.error(e.message); setLoading(false); });
  };

  useEffect(() => { load(); }, [period]);

  if (loading || !data) return <PageLoading />;

  const { kpis, sparkline, currentRange, previousRange, averages, statusBreakdown, topProvinces, topProviders, attention } = data;

  const totalOrders = kpis.orders.current;
  const cancelled = statusBreakdown.find((s) => s.status === 'cancelled')?.count || 0;
  const cancelRate = totalOrders > 0 ? Math.round((cancelled / totalOrders) * 1000) / 10 : 0;
  const maxOrders = Math.max(...sparkline.map((s) => s.orders), 1);
  const maxRevenue = Math.max(...sparkline.map((s) => s.revenue), 1);
  const provincesMax = rankMax(topProvinces);
  const providersMax = rankMax(topProviders);

  return (
    <div>
      <PageHead title={t('ad.exec.title')} subtitle={t('ad.exec.subtitle')} actions={<><div className="filters" style={{ gap: 8 }}>
          <select value={period} onChange={(e) => setPeriod(e.target.value as any)} style={{ maxWidth: 160 }}>
            {PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <button type="button" className="btn btn-outline" onClick={load} title={t('ad.exec.refresh')}>↻</button></div></>} />

      <div className="alert-info" style={{ marginBottom: 16, fontSize: 13 }}>
        {t('ad.exec.currentPeriod')}: <strong>{currentRange.start.slice(0, 10)} → {currentRange.end.slice(0, 10)}</strong> | {t('ad.exec.previous')}: <strong>{previousRange.start.slice(0, 10)} → {previousRange.end.slice(0, 10)}</strong> | <span className="muted">{t('ad.exec.legend')}</span>
      </div>

      <div className="grid grid-4 mb-4">
        <KPICardWithTrend label={kpis.orders.label} value={fmt(kpis.orders.current)} icon="🧾" tone="primary" deltaPct={kpis.orders.deltaPct} deltaLabel={t('ad.exec.vsPrev')} sparklineData={sparkline} sparklineMetric="orders" />
        <KPICardWithTrend label={kpis.customers.label} value={fmt(kpis.customers.current)} icon="👥" tone="info" deltaPct={kpis.customers.deltaPct} deltaLabel={t('ad.exec.vsPrev')} sparklineData={sparkline} sparklineMetric="orders" />
        <KPICardWithTrend label={kpis.revenue.label} value={fmt(kpis.revenue.current)} icon="💰" tone="success" deltaPct={kpis.revenue.deltaPct} deltaLabel={t('ad.exec.vsPrev')} sparklineData={sparkline} sparklineMetric="revenue" />
        <KPICardWithTrend label={kpis.conversion.label} value={`${kpis.conversion.current}%`} icon="✅" tone="accent" deltaPct={kpis.conversion.deltaPct} deltaLabel={t('ad.exec.percentagePts')} sparklineData={sparkline} sparklineMetric="orders" />
      </div>

      <div className="grid grid-2 mb-4">
        <StatCard label={t('ad.exec.aov')} value={`${fmt(averages.aov)} ${t('ad.currency')}`} icon="📊" tone="primary" />
        <StatCard label={t('ad.exec.cancelRate')} value={`${cancelRate}%`} icon="⚠️" tone={cancelRate > 15 ? 'danger' : 'warn'} />
      </div>

      <div className="grid grid-2 mb-4">
        <div className="card">
          <div className="card-header"><h3>{t('ad.exec.ordersTrend')}</h3></div>
          <div className="card-body" style={{ height: 260 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '100%', gap: 8 }}>
              {sparkline.map((d, i) => {
                const barHeight = Math.max(4, (d.orders / maxOrders) * 200);
                return (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 0 }}>
                    <div style={{ flex: 1, width: '100%', background: 'linear-gradient(to top, var(--primary) 0%, transparent 100%)', borderRadius: '4px 4px 0 0', minHeight: 0, height: barHeight + 'px' }} title={d.label + ': ' + fmt(d.orders) + ' ' + t('ad.exec.order')} />
                    <span className="muted mono" style={{ fontSize: 10, whiteSpace: 'nowrap' }}>{d.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3>{t('ad.exec.revenueTrend')}</h3></div>
          <div className="card-body" style={{ height: 260 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '100%', gap: 8 }}>
              {sparkline.map((d, i) => {
                const barHeight = Math.max(4, (d.revenue / maxRevenue) * 200);
                return (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 0 }}>
                    <div style={{ flex: 1, width: '100%', background: 'linear-gradient(to top, var(--success) 0%, transparent 100%)', borderRadius: '4px 4px 0 0', minHeight: 0, height: barHeight + 'px' }} title={d.label + ': ' + fmt(d.revenue) + ' ' + t('ad.currency')} />
                    <span className="muted mono" style={{ fontSize: 10, whiteSpace: 'nowrap' }}>{d.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-2 mb-4">
        <div className="card">
          <div className="card-header"><h3>{t('ad.exec.statusDist')}</h3></div>
          <div className="card-body">
            {statusBreakdown.map((s) => (
              <div className="bar-row" key={s.status}>
                <div className="bar-label"><Badge status={s.status} map={ORDER_STATUS} /></div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${Math.max(3, (s.count / Math.max(1, ...statusBreakdown.map((x) => x.count))) * 100)}%`, background: STATUS_COLOR[s.status] || 'var(--primary)' }} />
                </div>
                <div className="bar-value">{fmt(s.count)}</div>
              </div>
            ))}
            <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
              {t('ad.exec.revenueByStatus')}: {statusBreakdown.map((s) => `${ORDER_STATUS[s.status]?.label || s.status} ${fmt(s.revenue)}`).join(' · ')}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3>{t('ad.exec.needsAttention')}</h3></div>
          <div className="card-body">
            {attention.pendingProviders === 0 && attention.pendingAgentWithdrawals === 0 ? (
              <div className="alert-success" style={{ fontSize: 13 }}>{t('ad.exec.noAttentionItems')}</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {attention.pendingProviders > 0 && (
                  <div className="alert-warning flex-between" style={{ fontSize: 13, margin: 0 }}>
                    <span>{t('ad.exec.pendingProviders')}</span>
                    <span className="badge badge-amber">{fmt(attention.pendingProviders)}</span>
                  </div>
                )}
                {attention.pendingAgentWithdrawals > 0 && (
                  <div className="alert-warning flex-between" style={{ fontSize: 13, margin: 0 }}>
                    <span>{t('ad.exec.pendingAgentWithdrawals')}</span>
                    <span className="badge badge-amber">{fmt(attention.pendingAgentWithdrawals)}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-2 mb-4">
        <div className="card">
          <div className="card-header"><h3>{t('ad.exec.topProvinces')}</h3></div>
          <div className="card-body">
            {topProvinces.length === 0 ? <div className="muted">{t('ad.exec.noData')}</div> : topProvinces.map((p) => (
              <RankBar key={p.id} label={p.name} value={p.orders} sub={`${fmt(p.revenue)} ${t('ad.currency')}`} max={provincesMax} />
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3>{t('ad.exec.topProviders')}</h3></div>
          <div className="card-body">
            {topProviders.length === 0 ? <div className="muted">{t('ad.exec.noData')}</div> : topProviders.map((p) => (
              <RankBar key={p.id} label={p.name} value={p.orders} sub={`${fmt(p.revenue)} ${t('ad.currency')}`} max={providersMax} />
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><h3>{t('ad.exec.kpiDetail')}</h3></div>
        <div className="card-body">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'right', borderBottom: '2px solid var(--border)' }}>
                <th style={{ padding: '8px' }}>{t('ad.exec.kpiIndicator')}</th>
                <th style={{ padding: '8px' }}>{t('ad.exec.current')}</th>
                <th style={{ padding: '8px' }}>{t('ad.exec.previous')}</th>
                <th style={{ padding: '8px' }}>{t('ad.exec.change')}</th>
                <th style={{ padding: '8px' }}>{t('ad.exec.state')}</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(kpis).map(([key, kpi]) => (
                <tr key={key} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 8px', fontWeight: 600 }}>{kpi.label}</td>
                  <td style={{ padding: '10px 8px', fontFamily: 'monospace' }}>{key === 'conversion' ? `${kpi.current}%` : fmt(kpi.current)}</td>
                  <td style={{ padding: '10px 8px', fontFamily: 'monospace' }}>{key === 'conversion' ? `${kpi.previous}%` : fmt(kpi.previous)}</td>
                  <td style={{ padding: '10px 8px', fontFamily: 'monospace' }}>
                    <span className={`badge ${kpi.deltaPct > 0 ? 'badge-green' : kpi.deltaPct < 0 ? 'badge-red' : 'badge-gray'}`}>
                      {kpi.deltaPct > 0 ? '↑' : kpi.deltaPct < 0 ? '↓' : '→'} {Math.abs(kpi.deltaPct).toFixed(1)}%
                    </span>
                  </td>
                  <td style={{ padding: '10px 8px' }}>
                    {kpi.deltaPct > 0 ? <span className="badge badge-green">↑ {t('ad.exec.up')}</span> : kpi.deltaPct < 0 ? <span className="badge badge-red">↓ {t('ad.exec.down')}</span> : <span className="badge badge-gray">→ {t('ad.exec.flat')}</span>}
                  </td>
                </tr>
              ))}
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '10px 8px', fontWeight: 600 }}>{t('ad.exec.aov')}</td>
                <td style={{ padding: '10px 8px', fontFamily: 'monospace' }}>{fmt(averages.aov)} {t('ad.currency')}</td>
                <td style={{ padding: '10px 8px', fontFamily: 'monospace' }}>{fmt(averages.aovPrevious)} {t('ad.currency')}</td>
                <td style={{ padding: '10px 8px', fontFamily: 'monospace' }} colSpan={3}>
                  <span className="muted">{t('ad.exec.aovNote')}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
