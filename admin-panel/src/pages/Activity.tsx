import { useEffect, useState } from 'react';
import { api, downloadFile } from '../api';
import { useToast, fmtDate, PageLoading, EmptyState, Pagination, Modal, Badge } from '@rafidain/shared/ui';
import { PageHead } from '@rafidain/shared/ui';
import { t } from '@rafidain/shared/i18n';
import { useLocale } from '@rafidain/shared';

export default function Activity() {
  useLocale();
  const ACTION_LABELS: Record<string, string> = {
    login: t('ad.act.login'), login_2fa_pending: t('ad.act.login2faPending'), logout: t('ad.act.logout'), logout_all: t('ad.act.logoutAll'),
    create: t('ad.act.create'), update: t('ad.act.update'), delete: t('ad.act.delete'), activate: t('ad.act.activate'), deactivate: t('ad.act.deactivate'),
    verify: t('ad.act.verify'), unverify: t('ad.act.unverify'), renew_lease: t('ad.act.renewLease'), approve_lease: t('ad.act.approveLease'),
    reject_lease: t('ad.act.rejectLease'), request_lease_renewal: t('ad.act.requestLeaseRenewal'), order_status: t('ad.act.orderStatus'),
    reset_password: t('ad.act.resetPassword'), change_password: t('ad.act.changePassword'), enable_2fa: t('ad.act.enable2fa'),
    disable_2fa: t('ad.act.disable2fa'), reset_2fa: t('ad.act.reset2fa'), register_customer: t('ad.act.registerCustomer'),
    verify_email: t('ad.act.verifyEmail'), wallet_recharge: t('ad.act.walletRecharge'), recharge_request: t('ad.act.rechargeRequest'),
    recharge_approve: t('ad.act.rechargeApprove'), recharge_reject: t('ad.act.rechargeReject'), promotion_create: t('ad.act.promotionCreate'),
    promotion_extend: t('ad.act.promotionExtend'), promotion_end: t('ad.act.promotionEnd'), agent_withdrawal_approve: t('ad.act.agentWithdrawalApprove'),
    agent_withdrawal_reject: t('ad.act.agentWithdrawalReject'), agent_withdrawal_request: t('ad.act.agentWithdrawalRequest'), provider_broadcast: t('ad.act.providerBroadcast'),
    remind_pending_orders: t('ad.act.remindPendingOrders'), reply_rating: t('ad.act.replyRating'), submit_verification: t('ad.act.submitVerification'),
    create_lease: t('ad.act.createLease'), update_lease: t('ad.act.updateLease'), cancel_lease_payment: t('ad.act.cancelLeasePayment'),
    revoke_lease: t('ad.act.revokeLease'),
  };

  const ENTITY_LABELS: Record<string, string> = {
    user: t('ad.act.entityUser'), governorate: t('ad.act.entityGovernorate'), agent: t('ad.act.entityAgent'), provider: t('ad.act.entityProvider'),
    customer: t('ad.act.entityCustomer'), service: t('ad.act.entityService'), order: t('ad.act.entityOrder'), settings: t('ad.act.entitySettings'), commissions: t('ad.act.entityCommissions'),
    wallet: t('ad.act.entityWallet'), promotion: t('ad.act.entityPromotion'), coupon: t('ad.act.entityCoupon'), item: t('ad.act.entityItem'), provider_rating: t('ad.act.entityProviderRating'),
    activity_log: t('ad.act.entityActivityLog'), system: t('ad.act.entitySystem'), roles: t('ad.act.entityRoles'), users: t('ad.act.entityUsers'),
  };
  const [rows, setRows] = useState<any>(null);
  const [meta, setMeta] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ action: '', entity_type: '', entity_id: '', actor_id: '', from: '', to: '' });
  const [detailRow, setDetailRow] = useState<any>(null);
  const toast = useToast();

  const load = () => {
    const p = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v) p.set(k, v); });
    p.set('page', String(page));
    p.set('limit', '20');
    api.get(`/activity?${p}`).then((r) => { setRows(r.data); setMeta(r.meta || null); }).catch((e) => toast.error(e.message));
  };
  useEffect(() => { load(); }, [filters, page]);
  useEffect(() => { setPage(1); }, [filters]);

  const goPage = (n: any) => { setPage(n); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  const exportCsv = async () => {
    try {
      const p = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => { if (v) p.set(k, v); });
      await downloadFile(`/api/activity/export?${p}`, `audit-log-${new Date().toISOString().slice(0, 10)}.csv`);
      toast.success(t('ad.act.exportDone'));
    } catch (e: any) { toast.error(e.message); }
  };

  if (!rows) return <PageLoading />;

  return (
    <div>
      <PageHead title={t('ad.act.title')} subtitle={t('ad.act.subtitle')} actions={<><button className="btn btn-outline" onClick={exportCsv}>⬇ {t('ad.act.exportCsvBtn')}</button></>} />

      <div className="filters" style={{ flexWrap: 'wrap', gap: 8 }}>
        <select value={filters.action} onChange={e => setFilters({...filters, action: e.target.value})} style={{ minWidth: 180 }}>
          <option value="">{t('ad.act.allActions')}</option>
          {Object.keys(ACTION_LABELS).map((k) => <option key={k} value={k}>{ACTION_LABELS[k]}</option>)}
        </select>
        <select value={filters.entity_type} onChange={e => setFilters({...filters, entity_type: e.target.value})} style={{ minWidth: 160 }}>
          <option value="">{t('ad.act.allEntityTypes')}</option>
          {Object.keys(ENTITY_LABELS).map((k) => <option key={k} value={k}>{ENTITY_LABELS[k]}</option>)}
        </select>
        <input type="text" placeholder={t('ad.act.entityIdPlaceholder')} value={filters.entity_id} onChange={e => setFilters({...filters, entity_id: e.target.value})} style={{ width: 120 }} />
        <input type="text" placeholder={t('ad.act.actorIdPlaceholder')} value={filters.actor_id} onChange={e => setFilters({...filters, actor_id: e.target.value})} style={{ width: 120 }} />
        <input type="date" value={filters.from} onChange={e => setFilters({...filters, from: e.target.value})} title={t('ad.act.fromDate')} />
        <input type="date" value={filters.to} onChange={e => setFilters({...filters, to: e.target.value})} title={t('ad.act.toDate')} />
        {(filters.from || filters.to || filters.action || filters.entity_type || filters.entity_id || filters.actor_id) && (
          <button className="btn btn-ghost btn-sm" onClick={() => setFilters({action:'',entity_type:'',entity_id:'',actor_id:'',from:'',to:''})}>{t('ad.act.clearFilters')} ✕</button>
        )}
      </div>

      <div className="card">
        <div className="table-wrap">
          {rows.length === 0 ? <EmptyState text={t('ad.act.empty')} icon="📋" /> : (
            <table>
              <thead>
                <tr><th>{t('ad.orders.date')}</th><th>{t('ad.act.actor')}</th><th>{t('ad.act.role')}</th><th>{t('ad.act.action')}</th><th>{t('ad.act.entity')}</th><th>IP</th><th>{t('ad.act.details')}</th><th></th></tr>
              </thead>
              <tbody>
                {rows.map((r: any) => (
                  <tr key={r.id} style={{ cursor: detailRow === r.id ? 'default' : 'pointer' }} onClick={() => setDetailRow(detailRow === r.id ? null : r)}>
                    <td className="muted">{fmtDate(r.created_at)}</td>
                    <td className="bold">{r.actor_name || t('ad.act.system')}</td>
                    <td><span className="badge badge-gray">{r.actor_role}</span></td>
                    <td><span className="badge badge-blue">{ACTION_LABELS[r.action] || r.action}</span></td>
                    <td>{ENTITY_LABELS[r.entity_type] || r.entity_type}{r.entity_id ? ` <span className="mono">#${r.entity_id}</span>` : ''}</td>
                    <td className="muted mono" style={{ fontSize: 11, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.ip_address || '—'}</td>
                    <td className="muted" style={{ maxWidth: 200 }}>{r.details ? <span className="mono" style={{ fontSize: 11 }}>{r.details.length > 80 ? r.details.slice(0, 80) + '…' : r.details}</span> : '-'}</td>
                    <td style={{ width: 32, textAlign: 'center' }}><span className={detailRow === r.id ? '🔼' : '🔽'} style={{ fontSize: 12, cursor: 'pointer' }} onClick={e => { e.stopPropagation(); setDetailRow(detailRow === r.id ? null : r); }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Pagination meta={meta} page={page} onChange={goPage} />

      {/* Detail Modal */}
      <Modal open={!!detailRow} title={t('ad.act.detailTitle', { id: detailRow?.id })} onClose={() => setDetailRow(null)} size="lg">
        {detailRow && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            <div><label className="muted">{t('ad.act.idLabel')}</label><div className="mono">{detailRow.id}</div></div>
            <div><label className="muted">{t('ad.orders.date')}</label><div>{fmtDate(detailRow.created_at)}</div></div>
            <div><label className="muted">{t('ad.act.actor')}</label><div className="bold">{detailRow.actor_name || t('ad.act.system')}</div></div>
            <div><label className="muted">{t('ad.act.actorEmail')}</label><div className="mono">{detailRow.actor_email || '—'}</div></div>
            <div><label className="muted">{t('ad.act.role')}</label><div><Badge status={detailRow.actor_role} map={{admin:{label:t('ad.act.roleAdmin'),cls:'badge-red'},agent:{label:t('ad.act.roleAgent'),cls:'badge-blue'},provider:{label:t('ad.act.roleProvider'),cls:'badge-green'},customer:{label:t('ad.act.roleCustomer'),cls:'badge-amber'},system:{label:t('ad.act.roleSystem'),cls:'badge-gray'}}} /></div></div>
            <div><label className="muted">{t('ad.act.action')}</label><div><Badge status={detailRow.action} map={{create:{label:t('ad.act.create'),cls:'badge-green'},update:{label:t('ad.act.update'),cls:'badge-blue'},delete:{label:t('ad.act.delete'),cls:'badge-red'},login:{label:t('ad.act.login'),cls:'badge-teal'},logout:{label:t('ad.act.logout'),cls:'badge-gray'}} } /></div></div>
            <div><label className="muted">{t('ad.act.entityType')}</label><div>{ENTITY_LABELS[detailRow.entity_type] || detailRow.entity_type}</div></div>
            <div><label className="muted">{t('ad.act.entityId')}</label><div className="mono">{detailRow.entity_id || '—'}</div></div>
            <div><label className="muted">{t('ad.act.ipAddress')}</label><div className="mono">{detailRow.ip_address || '—'}</div></div>
            <div><label className="muted">User Agent</label><div className="mono" style={{ fontSize: 11, wordBreak: 'break-all' }}>{detailRow.user_agent || '—'}</div></div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label className="muted">{t('ad.act.detailsJson')}</label>
              <pre className="mono" style={{ background: '#f8fafc', padding: 12, borderRadius: 8, maxHeight: 300, overflow: 'auto', fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {detailRow.details ? JSON.stringify(JSON.parse(detailRow.details), null, 2) : '—'}
              </pre>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}