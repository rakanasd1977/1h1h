import { useEffect, useState } from 'react';
import { api } from '../api';
import { useToast, fmt, fmtDate, PageLoading, StatCard, Badge, Field, Modal, RECHARGE_STATUS } from '@rafidain/shared/ui';
import { PageHead } from '@rafidain/shared/ui';
import { t } from '@rafidain/shared/i18n';
import { useLocale } from '@rafidain/shared';
import ImageUpload from '../components/ImageUpload';

const TX_BADGE: Record<string, any> = {
  recharge: { label: 'pr.wallet.txRecharge', cls: 'badge-teal' },
  commission: { label: 'pr.wallet.txCommission', cls: 'badge-purple' },
  refund: { label: 'pr.wallet.txRefund', cls: 'badge-blue' },
  promotion: { label: 'pr.wallet.txPromotion', cls: 'badge-amber' },
};

const METHODS = [
  { value: 'zain_cash', labelKey: 'pr.wallet.methodZainCash', kind: 'number' },
  { value: 'asia_pay', labelKey: 'pr.wallet.methodAsiaPay', kind: 'number' },
  { value: 'first_iraqi_bank', labelKey: 'pr.wallet.methodFirstIraqiBank', kind: 'iban' },
  { value: 'al_ahli_bank', labelKey: 'pr.wallet.methodAlAhliBank', kind: 'iban' },
];

export default function Wallet() {
  const [wallet, setWallet] = useState<any>(null);
  const [reqs, setReqs] = useState<any[]>([]);
  const [openReq, setOpenReq] = useState(false);
  const [method, setMethod] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [proof, setProof] = useState('');
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  useLocale();

  const load = () => {
    Promise.all([
      api.get('/wallets/provider').then((r) => r.data),
      api.get('/recharges/provider').then((r) => r.data).catch(() => []),
    ]).then(([w, r]) => { setWallet(w); setReqs(r); }).catch((e) => toast.error(e.message));
  };
  useEffect(() => { load(); }, []);

  const submitReq = async () => {
    const amt = Number(amount);
    if (!method) { toast.error(t('pr.wallet.chooseMethodError')); return; }
    if (!Number.isFinite(amt) || amt <= 0) { toast.error(t('pr.wallet.invalidAmountError')); return; }
    if (!proof) { toast.error(t('pr.wallet.noProofError')); return; }
    setSaving(true);
    try {
      const res = await api.post('/recharges', { amount: amt, payment_method: method, note: note || undefined, proof_image: proof });
      toast.success(t('pr.wallet.requestSentToast', { ref: res.data.reference }));
      setOpenReq(false);
      setMethod('');
      setAmount('');
      setNote('');
      setProof('');
      load();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  if (!wallet) return <PageLoading />;

  const rs = wallet.recharge_settings || { instructions: '', accounts: {} };
  const accounts: Record<string, any> = rs.accounts || {};
  const methodLabel = (m: string) => t(METHODS.find((mm) => mm.value === m)?.labelKey || '');
  const hasAccount = (m: string) => {
    const a = accounts[m] || {};
    return m === 'zain_cash' || m === 'asia_pay' ? Boolean(a.number) : Boolean(a.name) || Boolean(a.iban);
  };
  const showAccountInfo = method ? hasAccount(method) : false;

  const freeAlert = Number(wallet.free_orders_remaining) > 0
    ? t('pr.wallet.freeOrdersAlert', { remaining: Number(wallet.free_orders_remaining), limit: Number(wallet.free_orders_limit) })
    : Number(wallet.balance) <= 0
      ? t('pr.wallet.zeroBalanceAlert')
      : '';

  return (
    <div>
      <PageHead title={t('pr.wallet.title')} subtitle={t('pr.wallet.subtitle')} actions={<button className="btn btn-primary" onClick={() => setOpenReq(true)}>{t('pr.wallet.rechargeBtn')}</button>} />

      {freeAlert && (
        <div className={`alert ${Number(wallet.free_orders_remaining) > 0 ? 'alert-info' : 'alert-warning'} mb-4`} dangerouslySetInnerHTML={{ __html: freeAlert }}>
        </div>
      )}

      {Number(wallet.free_orders_remaining) === 0 && Number(wallet.balance) <= 0 && (
        <button className="btn btn-primary btn-sm mb-4" onClick={() => setOpenReq(true)}>{t('pr.wallet.rechargeNow')}</button>
      )}

      <div className="alert alert-info mb-4" dangerouslySetInnerHTML={{ __html: t('pr.wallet.rechargeInstructions') }}>
      </div>

      <div className="grid grid-3 mb-4">
        <StatCard label={t('pr.wallet.balanceLabel')} value={fmt(wallet.balance)} icon="💰" tone="success" />
        <StatCard label={t('pr.wallet.pendingRequests')} value={fmt(wallet.pending_recharges ?? 0)} icon="⏳" tone="info" />
        <StatCard label={t('pr.wallet.txCount')} value={fmt((wallet.transactions || []).length)} icon="📊" tone="muted" />
      </div>

      <div className="card mb-4">
        <div className="card-header"><h3>{t('pr.wallet.rechargeRequestsTitle')}</h3></div>
        <div className="table-wrap">
          {reqs.length === 0 ? (
            <div className="empty-state"><div className="big">📤</div><div>{t('pr.wallet.noRequests')}</div></div>
          ) : (
            <table>
              <thead><tr><th>{t('pr.wallet.thRef')}</th><th>{t('pr.wallet.thAmount')}</th><th>{t('pr.wallet.thMethod')}</th><th>{t('pr.wallet.thStatus')}</th><th>{t('pr.wallet.thRejection')}</th><th>{t('pr.wallet.thDate')}</th></tr></thead>
              <tbody>
                {reqs.map((r: any) => (
                  <tr key={r.id}>
                    <td className="mono">{r.reference}</td>
                    <td className="bold">{fmt(r.amount)}</td>
                    <td>{r.payment_method_label || '-'}</td>
                    <td><Badge status={r.status} map={RECHARGE_STATUS} /></td>
                    <td className="muted">{r.admin_note || '-'}</td>
                    <td className="muted">{fmtDate(r.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header"><h3>{t('pr.wallet.txHistoryTitle')}</h3></div>
        <div className="table-wrap">
          {wallet.transactions.length === 0 ? (
            <div className="empty-state"><div className="big">📒</div><div>{t('pr.wallet.noTransactions')}</div></div>
          ) : (
            <table>
              <thead><tr><th>{t('pr.wallet.thTxType')}</th><th>{t('pr.wallet.thTxAmount')}</th><th>{t('pr.wallet.thAgentShare')}</th><th>{t('pr.wallet.thPlatformShare')}</th><th>{t('pr.wallet.thTxOrder')}</th><th>{t('pr.wallet.thBalanceAfter')}</th><th>{t('pr.wallet.thDate')}</th></tr></thead>
              <tbody>
                {wallet.transactions.map((tx: any) => (
                  <tr key={tx.id}>
                    <td><Badge status={tx.type} map={TX_BADGE} /></td>
                    <td style={{ color: Number(tx.amount) >= 0 ? 'var(--success)' : 'var(--danger)' }} className="bold">{Number(tx.amount) >= 0 ? '+' : ''}{fmt(tx.amount)}</td>
                    <td className="muted">{fmt(tx.agent_amount || 0)}</td>
                    <td className="muted">{fmt(tx.platform_amount || 0)}</td>
                    <td>{tx.order_number || '-'}</td>
                    <td className="muted">{fmt(tx.balance_after)}</td>
                    <td className="muted">{fmtDate(tx.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Modal open={openReq} title={t('pr.wallet.requestModalTitle')} onClose={() => setOpenReq(false)} size="lg">
        <p className="muted mb-4" dangerouslySetInnerHTML={{ __html: t('pr.wallet.requestModalHint') }}>
        </p>
        <div className="form-grid">
          <Field label={t('pr.wallet.fieldMethod')} required full>
            <select value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="">—</option>
              {METHODS.map((m) => <option key={m.value} value={m.value}>{t(m.labelKey)}</option>)}
            </select>
          </Field>
          {method && (
            <div className="card mb-4" style={{ gridColumn: '1 / -1' }}>
              <div className="card-body">
                <h4 style={{ marginBottom: 8 }}>{t('pr.wallet.accountInfoTitle', { method: methodLabel(method) })}</h4>
                {showAccountInfo ? (
                  <>
                    <p className="muted" style={{ marginBottom: 8, fontSize: 13 }}>{t('pr.wallet.rechargeInstruction')}</p>
                    {METHODS.find((mm) => mm.value === method)?.kind === 'number' ? (
                      <p><span className="bold">{t('pr.wallet.walletNumbers')}</span> {accounts[method].number}</p>
                    ) : (
                      <>
                        <p><span className="bold">{t('pr.wallet.beneficiaryName')}</span> {accounts[method].name}</p>
                        <p><span className="bold">{t('pr.wallet.ibanNumbers')}</span> {accounts[method].iban}</p>
                      </>
                    )}
                  </>
                ) : (
                  <p className="muted">{t('pr.wallet.noAccountSet')}</p>
                )}
              </div>
            </div>
          )}
          <Field label={t('pr.wallet.fieldAmount')} required>
            <input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={t('pr.wallet.amountPlaceholder')} />
          </Field>
          <Field label={t('pr.wallet.fieldNote')}>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('pr.wallet.notePlaceholder')} />
          </Field>
        </div>
        <Field label={t('pr.wallet.fieldProof')} full>
          <ImageUpload value={proof} onChange={setProof} hint={t('pr.wallet.proofHint')} />
        </Field>
        <div className="form-actions">
          <button className="btn btn-outline" onClick={() => setOpenReq(false)}>{t('pr.wallet.cancel')}</button>
          <button className="btn btn-primary" onClick={submitReq} disabled={saving}>{saving ? t('pr.wallet.sending') : t('pr.wallet.sendRequest')}</button>
        </div>
      </Modal>
    </div>
  );
}