import { useEffect, useState } from 'react';
import { api, downloadFile } from '../api';
import { useToast, fmt, PageLoading, StatCard, EmptyState } from '@rafidain/shared/ui';
import type { CommissionsData } from '../types';
import { PageHead } from '@rafidain/shared/ui';
import { t } from '@rafidain/shared/i18n';
import { useLocale } from '@rafidain/shared';

export default function Commissions() {
  useLocale();
  const [data, setData] = useState<CommissionsData | null>(null);
  const toast = useToast();

  useEffect(() => {
    api.get('/agent/commissions').then((r) => setData(r.data)).catch((e) => toast.error(e.message));
  }, []);

  const exportCsv = async () => {
    try {
      await downloadFile('/api/agent/commissions/export', `commissions-${new Date().toISOString().slice(0, 10)}.csv`);
      toast.success(t('ag.commissions.exportToast'));
    } catch (e: any) { toast.error(e.message); }
  };

  if (!data) return <PageLoading />;

  const s = data.summary;
  const maxMonthly = Math.max(1, ...data.monthly.map((m) => m.commission));

  return (
    <div>
      <PageHead title={t('ag.commissions.title')} subtitle={t('ag.commissions.subtitle', { rate: data.commission_rate })} actions={<><button className="btn btn-outline" onClick={exportCsv}>{t('ag.commissions.exportCsv')}</button></>} />

      <div className="grid grid-3 mb-4">
        <StatCard label={t('ag.commissions.ordersCountNonCancelled')} value={fmt(s.orders_count)} icon="🧾" tone="info" />
        <StatCard label={t('ag.commissions.ordersValue')} value={fmt(s.orders_value)} icon="💵" tone="primary" />
        <StatCard label={t('ag.commissions.totalCommission')} value={fmt(s.total_commission)} icon="💰" tone="accent" />
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="card-header"><h3>{t('ag.commissions.monthlyTitle')}</h3></div>
          <div className="card-body">
            {data.monthly.length === 0 ? <EmptyState text={t('ag.commissions.noCommissionsYet')} icon="💰" /> : (
              data.monthly.map((m) => (
                <div className="bar-row" key={m.month}>
                  <span className="bar-label mono">{m.month}</span>
                  <div className="bar-track"><div className="bar-fill" style={{ width: `${(m.commission / maxMonthly) * 100}%` }} /></div>
                  <span className="bar-value">{fmt(m.commission)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3>{t('ag.commissions.topProvidersTitle')}</h3></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>{t('ag.commissions.th.provider')}</th><th>{t('ag.commissions.th.orders')}</th><th>{t('ag.commissions.th.yourComm')}</th></tr></thead>
              <tbody>
                {data.top_providers.length === 0 && <tr><td colSpan={3}><div className="muted" style={{ padding: 16 }}>{t('ag.commissions.noData')}</div></td></tr>}
                {data.top_providers.map((p) => (
                  <tr key={p.id}>
                    <td className="bold">{p.name_ar}</td>
                    <td>{fmt(p.orders_count)}</td>
                    <td>{fmt(p.commission)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
