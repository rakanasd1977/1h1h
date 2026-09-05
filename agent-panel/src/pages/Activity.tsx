import { useEffect, useState } from 'react';
import { api } from '../api';
import { useToast, fmtDate, PageLoading, EmptyState, Pagination } from '@rafidain/shared/ui';
import type { ActivityRow } from '../types';
import { PageHead } from '@rafidain/shared/ui';
import { t } from '@rafidain/shared/i18n';
import { useLocale } from '@rafidain/shared';

const ACTION_KEYS: Record<string, { label: string; icon: string }> = {
  create: { label: 'ag.activity.action.create', icon: '➕' },
  update: { label: 'ag.activity.action.update', icon: '✏️' },
  delete: { label: 'ag.activity.action.delete', icon: '🗑️' },
  activate: { label: 'ag.activity.action.activate', icon: '✅' },
  deactivate: { label: 'ag.activity.action.deactivate', icon: '⛔' },
  verify: { label: 'ag.activity.action.verify', icon: '🪪' },
  unverify: { label: 'ag.activity.action.unverify', icon: '🚫' },
  login: { label: 'ag.activity.action.login', icon: '🔐' },
  logout: { label: 'ag.activity.action.logout', icon: '👋' },
  logout_all: { label: 'ag.activity.action.logout_all', icon: '👋' },
  change_password: { label: 'ag.activity.action.change_password', icon: '🔑' },
  reset_password: { label: 'ag.activity.action.reset_password', icon: '🔑' },
  verify_email: { label: 'ag.activity.action.verify_email', icon: '📧' },
  register_customer: { label: 'ag.activity.action.register_customer', icon: '🆕' },
  order_status: { label: 'ag.activity.action.order_status', icon: '🧾' },
  request_lease_renewal: { label: 'ag.activity.action.request_lease_renewal', icon: '📜' },
  renew_lease: { label: 'ag.activity.action.renew_lease', icon: '📜' },
  create_lease: { label: 'ag.activity.action.create_lease', icon: '📜' },
  update_lease: { label: 'ag.activity.action.update_lease', icon: '📜' },
  approve_lease: { label: 'ag.activity.action.approve_lease', icon: '✅' },
  reject_lease: { label: 'ag.activity.action.reject_lease', icon: '❌' },
  revoke_lease: { label: 'ag.activity.action.revoke_lease', icon: '🚫' },
  cancel_lease_payment: { label: 'ag.activity.action.cancel_lease_payment', icon: '🚫' },
  provider_broadcast: { label: 'ag.activity.action.provider_broadcast', icon: '📢' },
  remind_pending_orders: { label: 'ag.activity.action.remind_pending_orders', icon: '⏰' },
  wallet_recharge: { label: 'ag.activity.action.wallet_recharge', icon: '💰' },
  recharge_request: { label: 'ag.activity.action.recharge_request', icon: '💰' },
  recharge_approve: { label: 'ag.activity.action.recharge_approve', icon: '✅' },
  recharge_reject: { label: 'ag.activity.action.recharge_reject', icon: '❌' },
  agent_withdrawal_request: { label: 'ag.activity.action.agent_withdrawal_request', icon: '💸' },
  promotion_create: { label: 'ag.activity.action.promotion_create', icon: '📣' },
  promotion_extend: { label: 'ag.activity.action.promotion_extend', icon: '📣' },
  promotion_end: { label: 'ag.activity.action.promotion_end', icon: '📣' },
  rate: { label: 'ag.activity.action.rate', icon: '⭐' },
  reply_rating: { label: 'ag.activity.action.reply_rating', icon: '💬' },
  submit_verification: { label: 'ag.activity.action.submit_verification', icon: '🪪' },
};

const ENTITY_KEYS: Record<string, string> = {
  agent: 'ag.activity.entity.agent', provider: 'ag.activity.entity.provider', order: 'ag.activity.entity.order', customer: 'ag.activity.entity.customer',
  user: 'ag.activity.entity.user', coupon: 'ag.activity.entity.coupon', promotion: 'ag.activity.entity.promotion', service: 'ag.activity.entity.service',
  governorate: 'ag.activity.entity.governorate', settings: 'ag.activity.entity.settings', provider_rating: 'ag.activity.entity.provider_rating',
  commissions: 'ag.activity.entity.commissions', customer_favorite: 'ag.activity.entity.customer_favorite',
};

export default function Activity() {
  useLocale();
  const [rows, setRows] = useState<ActivityRow[] | null>(null);
  const [meta, setMeta] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const toast = useToast();

  const load = (pg = page, act = action, f = from, t = to) => {
    const p = new URLSearchParams();
    if (act) p.set('action', act);
    if (f) p.set('from', f);
    if (t) p.set('to', t);
    p.set('page', String(pg));
    p.set('limit', '50');
    api.get(`/agent/activity?${p.toString()}`).then((r) => { setRows(r.data); setMeta(r.meta || null); }).catch((e) => toast.error(e.message));
  };

  useEffect(() => { load(); }, [page]);
  useEffect(() => { setPage(1); load(1, action, from, to); }, [action, from, to]);

  if (!rows) return <PageLoading />;

  return (
    <div>
      <PageHead title={t('ag.activity.title')} subtitle={t('ag.activity.subtitle')} />

      <div className="filters">
        <select value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="">{t('ag.activity.allActivities')}</option>
          {Object.keys(ACTION_KEYS).sort().map((a) => <option key={a} value={a}>{ACTION_KEYS[a].icon} {t(ACTION_KEYS[a].label)}</option>)}
        </select>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} title={t('ag.activity.fromDate')} />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} title={t('ag.activity.toDate')} />
        {(from || to) && <button className="btn btn-ghost btn-sm" onClick={() => { setFrom(''); setTo(''); }}>{t('ag.activity.clearRange')}</button>}
      </div>

      <div className="card">
        <div className="table-wrap">
          {rows.length === 0 ? <EmptyState text={t('ag.activity.emptyText')} icon="📭" /> : (
            <table>
              <thead>
                <tr><th>{t('ag.activity.th.event')}</th><th>{t('ag.activity.th.entity')}</th><th>{t('ag.activity.th.actor')}</th><th>{t('ag.activity.th.details')}</th><th>{t('ag.activity.th.date')}</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const am = ACTION_KEYS[r.action] || { label: '', icon: '•' };
                  const d = r.details;
                  const detailText = d
                    ? (d.order_number ? t('ag.activity.orderDetail', { number: d.order_number }) : d.name_ar || d.governorate || d.role || Object.keys(d).map((k) => `${k}: ${d[k]}`).join(' • '))
                    : '';
                  return (
                    <tr key={r.id}>
                      <td><span className="bold">{am.icon} {t(am.label)}</span></td>
                      <td>{t(ENTITY_KEYS[r.entity_type] || '') || r.entity_type}{r.entity_id ? ` #${r.entity_id}` : ''}</td>
                      <td>{r.actor_name || '-'}<div className="muted" style={{ fontSize: 11 }}>{r.actor_role}</div></td>
                      <td className="muted" style={{ fontSize: 12, maxWidth: 320 }}>{detailText}</td>
                      <td className="muted">{fmtDate(r.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Pagination meta={meta} page={page} onChange={setPage} />
    </div>
  );
}
