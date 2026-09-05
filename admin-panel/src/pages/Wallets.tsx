import { useEffect, useState } from 'react';
import { api } from '../api';
import { useToast, fmt, fmtDate, PageLoading, EmptyState, Modal, Field, Badge, Pagination, RECHARGE_STATUS } from '@rafidain/shared/ui';
import { PageHead } from '@rafidain/shared/ui';
import { t } from '@rafidain/shared/i18n';
import { useLocale } from '@rafidain/shared';

export default function Wallets() {
  useLocale();
  const TX_LABELS = {
    recharge: { label: t('ad.wallet.txRecharge'), cls: 'badge-green' },
    commission: { label: t('ad.wallet.txCommission'), cls: 'badge-amber' },
    refund: { label: t('ad.wallet.txRefund'), cls: 'badge-blue' },
  };
  const [tab, setTab] = useState('wallets');
  const [rows, setRows] = useState<any>(null);
  const [wMeta, setWMeta] = useState<any>(null);
  const [wPage, setWPage] = useState(1);
  const [q, setQ] = useState('');
  const [recharge, setRecharge] = useState<any>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [ledger, setLedger] = useState<any>(null);
  const [ledgerProvider, setLedgerProvider] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const [requests, setRequests] = useState<any>(null);
  const [rMeta, setRMeta] = useState<any>(null);
  const [rPage, setRPage] = useState(1);
  const [rStatus, setRStatus] = useState('');
  const [rQ, setRQ] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState<string>('');

  const toast = useToast();

  const loadWallets = (pg = wPage) => {
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    p.set('page', String(pg));
    p.set('limit', '20');
    api.get(`/wallets?${p}`).then((r) => { setRows(r.data); setWMeta(r.meta || null); }).catch((e) => toast.error(e.message));
  };
  const loadRequests = (pg = rPage) => {
    const p = new URLSearchParams();
    if (rStatus) p.set('status', rStatus);
    if (rQ) p.set('q', rQ);
    p.set('page', String(pg));
    p.set('limit', '20');
    const qs = p.toString();
    api.get(`/recharges${qs ? '?' + qs : ''}`).then((r) => { setRequests(r.data); setRMeta(r.meta || null); }).catch((e) => toast.error(e.message));
  };
  useEffect(() => { loadWallets(); }, [wPage]);
  useEffect(() => { loadRequests(); }, [rPage, rStatus]);

  const searchWallets = () => { setWPage(1); loadWallets(1); };
  const searchRequests = () => { setRPage(1); loadRequests(1); };

  const doRecharge = async () => {
    const amt = Number(amount);
    if (!amount || !Number.isFinite(amt) || amt <= 0) return toast.error(t('ad.wallet.rechargeAmountError'));
    setSaving(true);
    try {
      const res = await api.post(`/wallets/${recharge.provider_id}/recharge`, { amount: amt, note });
      toast.success(t('ad.wallet.recharged', { amount: fmt(res.data.amount), provider: recharge.provider_name || '' }));
      setRecharge(null); setAmount(''); setNote('');
      loadWallets();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  const viewLedger = async (p: any) => {
    try {
      const res = await api.get(`/wallets/${p.provider_id}`);
      setLedger(res.data);
      setLedgerProvider(p);
    } catch (e: any) { toast.error(e.message); }
  };

  const viewRequest = async (r: any) => {
    try {
      const res = await api.get(`/recharges/${r.id}`);
      setSelected(res.data);
    } catch (e: any) { toast.error(e.message); }
  };

  const approveRequest = async () => {
    setSaving(true);
    try {
      const res = await api.post(`/recharges/${selected.id}/approve`);
      toast.success(t('ad.wallet.approved', { reference: res.data.reference, amount: fmt(res.data.amount) }));
      setSelected(null);
      loadRequests();
      loadWallets();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  const rejectRequest = async () => {
    if (!rejectReason.trim()) return toast.error(t('ad.wallet.rejectReasonError'));
    setSaving(true);
    try {
      await api.post(`/recharges/${selected.id}/reject`, { reason: rejectReason.trim() });
      toast.success(t('ad.wallet.rejected'));
      setRejectOpen(false);
      setRejectReason('');
      setSelected(null);
      loadRequests();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  if (!rows || !requests) return <PageLoading />;

  const totalBalance = rows.reduce((s: any, r: any) => s + Number(r.balance || 0), 0);
  const pendingCount = requests.filter((r: any) => r.status === 'pending').length;

  return (
    <div>
      <PageHead title={t('ad.wallet.title')} subtitle={t('ad.wallet.subtitle')} />

      <div className="tabs">
        <button className={`tab ${tab === 'wallets' ? 'tab--active' : ''}`} onClick={() => setTab('wallets')}>{t('ad.wallet.walletsTab')}</button>
        <button className={`tab ${tab === 'recharges' ? 'tab--active' : ''}`} onClick={() => setTab('recharges')}>
          {t('ad.wallet.rechargesTab')} {pendingCount > 0 && <span className="tab-badge">{pendingCount}</span>}
        </button>
      </div>

      {tab === 'wallets' && (
        <>
          <div className="stats-grid">
            <div className="card stat-card">
              <div className="stat-label">{t('ad.wallet.totalBalance')}</div>
              <div className="stat-value">{fmt(totalBalance)} {t('ad.currency')}</div>
            </div>
            <div className="card stat-card">
              <div className="stat-label">{t('ad.wallet.providerCount')}</div>
              <div className="stat-value">{rows.length}</div>
            </div>
            <div className="card stat-card">
              <div className="stat-label">{t('ad.wallet.pendingRecharges')}</div>
              <div className="stat-value" style={{ color: pendingCount ? 'var(--danger)' : undefined }}>{pendingCount}</div>
            </div>
          </div>

          <div className="filters">
            <input placeholder={t('ad.wallet.searchPlaceholder')} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && searchWallets()} />
            <button className="btn btn-outline btn-sm" onClick={searchWallets}>{t('ad.common.search')}</button>
          </div>

          <div className="card">
            <div className="table-wrap">
              {rows.length === 0 ? <EmptyState text={t('ad.wallet.noProviders')} icon="🏪" /> : (
                <table>
                  <thead>
                    <tr>
                      <th>{t('ad.provider.provider')}</th><th>{t('ad.svc.service')}</th><th>{t('ad.agent.gov')}</th><th>{t('ad.wallet.balance')}</th><th>{t('ad.wallet.txCount')}</th><th>{t('ad.common.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((p: any) => (
                      <tr key={p.provider_id}>
                        <td className="bold">{p.provider_name}</td>
                        <td><span className="badge badge-blue">{p.service_name_ar}</span></td>
                        <td><span className="badge badge-teal">{p.governorate_name_ar}</span></td>
                        <td className="bold" style={{ color: Number(p.balance) > 0 ? 'var(--success)' : 'var(--danger)' }}>{fmt(p.balance)}</td>
                        <td className="muted">{p.tx_count}</td>
                        <td>
                          <div className="flex">
                            <button className="btn btn-primary btn-sm" onClick={() => setRecharge(p)}>+ {t('ad.wallet.rechargeBtn')}</button>
                            <button className="btn btn-outline btn-sm" onClick={() => viewLedger(p)}>{t('ad.wallet.ledgerBtn')}</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <Pagination meta={wMeta} page={wPage} onChange={setWPage} />
        </>
      )}

      {tab === 'recharges' && (
        <>
          <div className="filters">
            <select value={rStatus} onChange={(e) => { setRStatus(e.target.value); setRPage(1); }}>
              <option value="">{t('ad.wallet.allStatuses')}</option>
              <option value="pending">{t('ad.wallet.statusPending')}</option>
              <option value="approved">{t('ad.wallet.statusApproved')}</option>
              <option value="rejected">{t('ad.wallet.statusRejected')}</option>
            </select>
            <input placeholder={t('ad.wallet.rechargeSearchPlaceholder')} value={rQ} onChange={(e) => setRQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && searchRequests()} />
            <button className="btn btn-outline btn-sm" onClick={searchRequests}>{t('ad.common.search')}</button>
          </div>

          <div className="card">
            <div className="table-wrap">
              {requests.length === 0 ? <EmptyState text={t('ad.wallet.noRecharges')} icon="💸" /> : (
                <table>
                  <thead>
                    <tr><th>{t('ad.wallet.reference')}</th><th>{t('ad.provider.provider')}</th><th>{t('ad.agent.gov')}</th><th>{t('ad.wallet.amount')}</th><th>{t('ad.wallet.paymentMethod')}</th><th>{t('ad.common.status')}</th><th>{t('ad.orders.date')}</th><th>{t('ad.common.actions')}</th></tr>
                  </thead>
                  <tbody>
                    {requests.map((r: any) => (
                      <tr key={r.id}>
                        <td><span className="mono bold">{r.reference}</span></td>
                        <td className="bold">{r.provider_name}</td>
                        <td className="muted">{r.governorate_name_ar}</td>
                        <td className="bold">{fmt(r.amount)}</td>
                        <td>{r.payment_method_label}</td>
                        <td><Badge status={r.status} map={RECHARGE_STATUS} /></td>
                        <td className="muted">{fmtDate(r.created_at)}</td>
                        <td>
                          <button className="btn btn-outline btn-sm" onClick={() => viewRequest(r)}>
                            {r.status === 'pending' ? t('ad.provider.reviewBtn') : t('ad.common.details')}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <Pagination meta={rMeta} page={rPage} onChange={setRPage} />
        </>
      )}

      <Modal open={!!recharge} title={`${t('ad.wallet.rechargeModalTitle')} ${recharge?.provider_name || ''}`} onClose={() => setRecharge(null)}>
        <Field label={t('ad.wallet.amount')} required>
          <input type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
        </Field>
        <Field label={t('ad.orders.notes')}>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('ad.wallet.notePlaceholder')} />
        </Field>
        <div className="form-actions">
          <button className="btn btn-outline" onClick={() => setRecharge(null)}>{t('ad.common.cancel')}</button>
          <button className="btn btn-primary" onClick={doRecharge} disabled={saving}>{saving ? t('ad.wallet.recharging') : t('ad.wallet.rechargeBtn')}</button>
        </div>
      </Modal>

      <Modal open={!!ledger} title={`${t('ad.wallet.ledgerTitle')} ${ledgerProvider?.provider_name || ''}`} onClose={() => setLedger(null)} size="lg">
        <p className="muted mb-4">{t('ad.wallet.currentBalance')}: <strong className="bold" style={{ color: 'var(--success)' }}>{fmt(ledger?.balance)} {t('ad.currency')}</strong></p>
        {ledger?.transactions?.length === 0 ? <EmptyState text={t('ad.wallet.noTransactions')} icon="📒" /> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>{t('ad.wallet.txType')}</th><th>{t('ad.wallet.amount')}</th><th>{t('ad.wallet.agentShare')}</th><th>{t('ad.wallet.platformShare')}</th><th>{t('ad.wallet.order')}</th><th>{t('ad.wallet.balanceAfter')}</th><th>{t('ad.wallet.note')}</th><th>{t('ad.orders.date')}</th></tr>
              </thead>
              <tbody>
                {ledger?.transactions?.map((t: any) => (
                  <tr key={t.id}>
                    <td><span className={`badge ${(TX_LABELS as any)[t.type]?.cls || 'badge-gray'}`}>{(TX_LABELS as any)[t.type]?.label || t.type}</span></td>
                    <td className="bold" style={{ color: t.amount < 0 ? 'var(--danger)' : 'var(--success)' }}>{fmt(t.amount)}</td>
                    <td>{fmt(t.agent_amount)}</td>
                    <td>{fmt(t.platform_amount)}</td>
                    <td className="mono muted">{t.order_number || '-'}</td>
                    <td>{fmt(t.balance_after)}</td>
                    <td className="muted" style={{ maxWidth: 220 }}>{t.note || '-'}</td>
                    <td className="muted">{fmtDate(t.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      <Modal open={!!selected} title={`${t('ad.wallet.rechargeRequest')} ${selected?.reference || ''}`} onClose={() => setSelected(null)} size="lg">
        {selected && (
          <>
            <div className="detail-grid mb-4">
              <div className="detail-item"><div className="k">{t('ad.common.status')}</div><div className="v"><Badge status={selected.status} map={RECHARGE_STATUS} /></div></div>
              <div className="detail-item"><div className="k">{t('ad.provider.provider')}</div><div className="v">{selected.provider_name}<div className="muted">{selected.governorate_name_ar}</div></div></div>
              <div className="detail-item"><div className="k">{t('ad.wallet.amount')}</div><div className="v">{fmt(selected.amount)}</div></div>
              <div className="detail-item"><div className="k">{t('ad.wallet.paymentMethod')}</div><div className="v">{selected.payment_method_label}</div></div>
              <div className="detail-item"><div className="k">{t('ad.wallet.sentDate')}</div><div className="v">{fmtDate(selected.created_at)}</div></div>
              <div className="detail-item"><div className="k">{t('ad.wallet.handledBy')}</div><div className="v">{selected.handled_by || '-'}<div className="muted">{selected.handled_at ? fmtDate(selected.handled_at) : ''}</div></div></div>
              <div className="detail-item" style={{ gridColumn: '1 / -1' }}><div className="k">{t('ad.wallet.providerNote')}</div><div className="v">{selected.note || '-'}</div></div>
              {selected.admin_note && (
                <div className="detail-item" style={{ gridColumn: '1 / -1' }}><div className="k">{t('ad.wallet.rejectReason')}</div><div className="v" style={{ color: 'var(--danger)' }}>{selected.admin_note}</div></div>
              )}
            </div>

            <div className="card mb-4">
              <div className="card-header"><h3>🖼️ {t('ad.wallet.proofTitle')}</h3></div>
              <div className="card-body">
                {selected.proof_image ? (
                  <a href={selected.proof_image} target="_blank" rel="noreferrer"><img className="modal-img" src={selected.proof_image} alt={t('ad.wallet.proofAlt')} /></a>
                ) : <EmptyState text={t('ad.wallet.noProof')} icon="🖼️" />}
              </div>
            </div>

            {selected.status === 'pending' && (
              <div className="card">
                <div className="card-header"><h3>{t('ad.wallet.decision')}</h3></div>
                <div className="card-body flex wrap">
                  <button className="btn btn-success" disabled={saving} onClick={approveRequest}>{saving ? t('ad.common.processing') : `✓ ${t('ad.wallet.approveBtn')}`}</button>
                  <button className="btn btn-danger" disabled={saving} onClick={() => { setRejectReason(''); setRejectOpen(true); }}>{`✗ ${t('ad.wallet.rejectBtn')}`}</button>
                  <span className="muted">{t('ad.wallet.approveNote')}</span>
                </div>
              </div>
            )}
          </>
        )}
      </Modal>

      <Modal open={rejectOpen} title={`${t('ad.wallet.rejectRequestTitle')} ${selected?.reference || ''}`} onClose={() => setRejectOpen(false)}>
        <Field label={t('ad.wallet.rejectReasonField')} required>
          <textarea rows={3} value={rejectReason || ''} onChange={(e) => setRejectReason(e.target.value)} placeholder={t('ad.wallet.rejectReasonPlaceholder')} />
        </Field>
        <div className="form-actions">
          <button className="btn btn-outline" onClick={() => setRejectOpen(false)}>{t('ad.wallet.back')}</button>
          <button className="btn btn-danger" disabled={saving || !rejectReason.trim()} onClick={rejectRequest}>{saving ? t('ad.common.saving') : t('ad.wallet.rejectBtn')}</button>
        </div>
      </Modal>
    </div>
  );
}
