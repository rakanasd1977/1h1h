import { useEffect, useState } from 'react';
import { api, downloadFile } from '../api';
import { useToast, fmt, StatCard, PageLoading, EmptyState } from '@rafidain/shared/ui';
import { PageHead } from '@rafidain/shared/ui';
import { t } from '@rafidain/shared/i18n';
import { useLocale } from '@rafidain/shared';

export default function FinancialReport() {
  useLocale();
  const GROUPS = [
    { value: 'month', label: t('ad.fr.groupMonth') },
    { value: 'day', label: t('ad.fr.groupDay') },
    { value: 'week', label: t('ad.fr.groupWeek') },
    { value: 'governorate', label: t('ad.fr.groupGov') },
    { value: 'service', label: t('ad.fr.groupService') },
    { value: 'agent', label: t('ad.fr.groupAgent') },
    { value: 'provider', label: t('ad.fr.groupProvider') },
  ];
  const [data, setData] = useState<any>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [groupBy, setGroupBy] = useState('month');
  const toast = useToast();

  const load = (f = from, t = to, g = groupBy) => {
    const p = new URLSearchParams({ group_by: g });
    if (f) p.set('from', f);
    if (t) p.set('to', t);
    api.get(`/financial-report?${p}`)
      .then((r) => setData(r.data))
      .catch((e) => toast.error(e.message));
  };

  useEffect(() => { load(); }, []);

  const exportCsv = async () => {
    try {
      const p = new URLSearchParams({ group_by: groupBy });
      if (from) p.set('from', from);
      if (to) p.set('to', to);
      await downloadFile(`/api/financial-report/export?${p}`, `financial-report-${new Date().toISOString().slice(0, 10)}.csv`);
      toast.success(t('ad.fr.exportDone'));
    } catch (e: any) { toast.error(e.message); }
  };

  if (!data) return <PageLoading />;

  const s = data.summary;

  return (
    <div>
      <PageHead title={t('ad.fr.title')} subtitle={t('ad.fr.subtitle')} actions={<><button className="btn btn-outline" onClick={exportCsv}>⬇ {t('ad.fr.exportCsvBtn')}</button></>} />

      <div className="filters">
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} title={t('ad.act.fromDate')} />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} title={t('ad.act.toDate')} />
        <select value={groupBy} onChange={(e) => setGroupBy(e.target.value)}>
          {GROUPS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
        </select>
        <button className="btn btn-primary" onClick={() => load()}>{t('ad.fr.applyBtn')}</button>
        {(from || to || groupBy !== 'month') && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setFrom(''); setTo(''); setGroupBy('month'); load('', '', 'month'); }}>{t('ad.fr.reset')} ↺</button>
        )}
      </div>

      <div className="grid grid-3 mb-4">
        <StatCard label={t('ad.fr.ordersCount')} value={fmt(s.orders_count)} icon="🧾" tone="info" />
        <StatCard label={t('ad.fr.ordersValue')} value={fmt(s.orders_value)} icon="💵" tone="primary" />
        <StatCard label={t('ad.fr.avgOrderValue')} value={fmt(s.avg_order_value)} icon="📊" tone="info" />
      </div>
      <div className="grid grid-3 mb-4">
        <StatCard label={t('ad.fr.platformRevenue')} value={fmt(s.platform_revenue)} icon="💰" tone="success" />
        <StatCard label={t('ad.fr.agentRevenue')} value={fmt(s.agent_revenue)} icon="🤝" tone="accent" />
        <StatCard label={t('ad.fr.cancelledCount')} value={fmt(s.cancelled_count)} icon="🚫" tone="warn" />
      </div>

      <div className="card">
        <div className="card-header">
          <h3>{t('ad.fr.detailTitle')} — {GROUPS.find((g) => g.value === data.period.group_by)?.label}</h3>
          <span className="badge badge-gray">{t('ad.fr.period', { from: from || t('ad.fr.start'), to: to || t('ad.fr.now') })}</span>
        </div>
        <div className="table-wrap">
          {data.rows.length === 0 ? <EmptyState text={t('ad.fr.empty')} icon="📭" /> : (
            <table>
              <thead>
                <tr>
                  <th>{t('ad.fr.groupCol')}</th>
                  <th>{t('ad.fr.ordersCount')}</th>
                  <th>{t('ad.fr.ordersValue')}</th>
                  <th>{t('ad.fr.platformRevenue')}</th>
                  <th>{t('ad.fr.agentRevenue')}</th>
                  <th>{t('ad.fr.cancelledCount')}</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r: any) => (
                  <tr key={r.key}>
                    <td className="bold">{r.label}</td>
                    <td>{fmt(r.orders_count)}</td>
                    <td>{fmt(r.orders_value)}</td>
                    <td>{fmt(r.platform_revenue)}</td>
                    <td>{fmt(r.agent_revenue)}</td>
                    <td>{fmt(r.cancelled_count)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
