import { useEffect, useState } from 'react';
import { api, downloadFile } from '../api';
import { useToast, fmt, fmtDate, PageLoading, EmptyState, Badge, Pagination } from '@rafidain/shared/ui';
import type { Customer } from '../types';
import { PageHead } from '@rafidain/shared/ui';
import { t } from '@rafidain/shared/i18n';
import { useLocale } from '@rafidain/shared';

const REGISTERED = {
  yes: { label: 'ag.customers.registered', cls: 'badge-teal' },
  no: { label: 'ag.customers.directOrder', cls: 'badge-gray' },
};

export default function Customers() {
  useLocale();
  const [rows, setRows] = useState<Customer[] | null>(null);
  const [meta, setMeta] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [lapsed, setLapsed] = useState(false);
  const toast = useToast();

  const load = (pg = page, query = q, lp = lapsed) => {
    const p = new URLSearchParams();
    if (query) p.set('q', query);
    if (lp) p.set('lapsed', '1');
    p.set('page', String(pg));
    p.set('limit', '20');
    api.get(`/agent/customers?${p.toString()}`).then((r) => { setRows(r.data); setMeta(r.meta || null); }).catch((e) => toast.error(e.message));
  };

  useEffect(() => { load(); }, [page]);

  const search = () => { setPage(1); load(1, q, lapsed); };

  const toggleLapsed = () => {
    const next = !lapsed;
    setLapsed(next);
    setPage(1);
    load(1, q, next);
  };

  const exportCsv = async () => {
    try {
      const ps = new URLSearchParams();
      if (q) ps.set('q', q);
      if (lapsed) ps.set('lapsed', '1');
      const qs = ps.toString();
      await downloadFile(`/api/agent/customers/export${qs ? '?' + qs : ''}`, `customers-${new Date().toISOString().slice(0, 10)}.csv`);
      toast.success(t('ag.customers.exportToast'));
    } catch (e: any) { toast.error(e.message); }
  };

  if (!rows) return <PageLoading />;

  return (
    <div>
      <PageHead title={t('ag.customers.title')} subtitle={t('ag.customers.subtitle')} actions={<><div className="flex">
          <button className="btn btn-outline" onClick={exportCsv}>{t('ag.customers.exportCsv')}</button></div></>} />

      <div className="filters">
        <input placeholder={t('ag.customers.searchPlaceholder')} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} />
        <button className="btn btn-outline btn-sm" onClick={search}>{t('ag.customers.searchBtn')}</button>
      </div>

      <div className="chip-row mb-3">
        <button type="button" className={`chip${lapsed ? ' chip--active' : ''}`} onClick={toggleLapsed}>
          {t('ag.customers.returningCustomers')}
        </button>
      </div>

      <div className="card">
        <div className="table-wrap">
          {rows.length === 0 ? <EmptyState text={t('ag.customers.emptyText')} icon="👥" /> : (
            <table>
              <thead>
                <tr>
                  <th>{t('ag.customers.th.customer')}</th><th>{t('ag.customers.th.phone')}</th><th>{t('ag.customers.th.type')}</th><th>{t('ag.customers.th.orders')}</th>
                  <th>{t('ag.customers.th.totalPurchases')}</th><th>{t('ag.customers.th.pending')}</th><th>{t('ag.customers.th.lastOrder')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={`${c.id || 'w'}-${c.name}-${c.phone}`}>
                    <td>
                      <div className="bold">{c.name}</div>
                      <div className="muted" style={{ fontSize: 12 }}>{c.email || ''}</div>
                    </td>
                    <td dir="ltr">{c.phone || '-'}</td>
                    <td><Badge status={c.id ? 'yes' : 'no'} map={REGISTERED} /></td>
                    <td>{fmt(c.orders_count)}</td>
                    <td className="bold">{fmt(c.total_value)}</td>
                    <td>{fmt(c.pending_count)}</td>
                    <td className="muted">{c.last_order_at ? fmtDate(c.last_order_at) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Pagination meta={meta} page={page} onChange={setPage} />
    </div>
  );
}
