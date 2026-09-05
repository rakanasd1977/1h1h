import { useEffect, useState } from 'react';
import { api, downloadFile } from '../api';
import { useToast, fmt, fmtDate, PageLoading, StatCard, EmptyState, Modal, Field, Badge, WITHDRAWAL_STATUS } from '@rafidain/shared/ui';
import type { WalletData } from '../types';
import { PageHead } from '@rafidain/shared/ui';
import { t } from '@rafidain/shared/i18n';
import { useLocale } from '@rafidain/shared';

export default function Wallet() {
  useLocale();
  const [data, setData] = useState<WalletData | null>(null);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const load = () => {
    api.get('/agent/wallet').then((r) => setData(r.data)).catch((e) => toast.error(e.message));
  };

  useEffect(load, []);

  const exportCsv = async (type: string) => {
    try {
      await downloadFile(`/api/agent/wallet/export?type=${type}`, `wallet-${type}-${new Date().toISOString().slice(0, 10)}.csv`);
      toast.success(t('ag.wallet.exportToast'));
    } catch (e: any) { toast.error(e.message); }
  };

  if (!data) return <PageLoading />;

  const b = data.balance;

  const request = async () => {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error(t('ag.wallet.invalidAmount'));
      return;
    }
    setSaving(true);
    try {
      await api.post('/agent/wallet/withdraw', { amount: amt, notes: notes.trim() || undefined });
      toast.success(t('ag.wallet.requestSentToast'));
      setOpen(false);
      setAmount('');
      setNotes('');
      load();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  return (
    <div>
      <PageHead title={t('ag.wallet.title')} subtitle={t('ag.wallet.subtitle')} actions={<><div className="flex">
          <button className="btn btn-outline" onClick={() => exportCsv('income')}>{t('ag.wallet.incomeCsv')}</button>
          <button className="btn btn-outline" onClick={() => exportCsv('withdrawals')}>{t('ag.wallet.withdrawalsCsv')}</button>
          <button className="btn btn-primary" onClick={() => setOpen(true)}>{t('ag.wallet.withdrawBtn')}</button></div></>} />

      <div className="grid grid-4 mb-4">
        <StatCard label={t('ag.wallet.availableBalance')} value={fmt(b.available)} icon="💰" tone="accent" />
        <StatCard label={t('ag.wallet.totalEarned')} value={fmt(b.total_earned)} icon="💵" tone="primary" />
        <StatCard label={t('ag.wallet.pendingCommission')} value={fmt(b.pending_orders_commission)} icon="⏳" tone="info" />
        <StatCard label={t('ag.wallet.approvedWithdrawals')} value={fmt(b.approved_withdrawals)} icon="🏦" tone="success" />
      </div>
      {b.pending_withdrawals > 0 && (
        <div className="alert alert-info mb-4">{t('ag.wallet.pendingWithdrawalsAlert', { count: fmt(b.pending_withdrawals) })}</div>
      )}

      <div className="grid grid-2">
        <div className="card">
          <div className="card-header"><h3>{t('ag.wallet.recentIncome')}</h3></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>{t('ag.wallet.th.orderNumber')}</th><th>{t('ag.wallet.th.provider')}</th><th>{t('ag.wallet.th.agentComm')}</th><th>{t('ag.wallet.th.date')}</th></tr></thead>
              <tbody>
                {data.income.length === 0 && <tr><td colSpan={4}><EmptyState text={t('ag.wallet.noIncomeYet')} icon="💰" /></td></tr>}
                {data.income.map((o) => (
                  <tr key={o.id}>
                    <td className="mono bold">{o.order_number}</td>
                    <td>{o.provider_name}</td>
                    <td className="bold">{fmt(o.agent_amount)}</td>
                    <td className="muted">{fmtDate(o.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3>{t('ag.wallet.withdrawalRequests')}</h3></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>{t('ag.wallet.th.amount')}</th><th>{t('ag.wallet.th.status')}</th><th>{t('ag.wallet.th.notes')}</th><th>{t('ag.wallet.th.date')}</th></tr></thead>
              <tbody>
                {data.withdrawals.length === 0 && <tr><td colSpan={4}><EmptyState text={t('ag.wallet.noWithdrawalsYet')} icon="🏦" /></td></tr>}
                {data.withdrawals.map((w) => (
                  <tr key={w.id}>
                    <td className="bold">{fmt(w.amount)}</td>
                    <td><Badge status={w.status} map={WITHDRAWAL_STATUS} /></td>
                    <td className="muted">{w.notes || '-'}</td>
                    <td className="muted">{fmtDate(w.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Modal open={open} title={t('ag.wallet.withdrawModalTitle')} onClose={() => setOpen(false)}>
        <p className="muted mb-4">{t('ag.wallet.withdrawBalanceHint', { count: fmt(b.available) })}</p>
        <Field label={t('ag.wallet.amountLabel')} required>
          <input type="number" min="1000" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={t('ag.wallet.amountPlaceholder')} />
        </Field>
        <Field label={t('ag.wallet.notesLabel')}>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('ag.wallet.notesPlaceholder')} />
        </Field>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={() => setOpen(false)}>{t('ag.wallet.cancel')}</button>
          <button className="btn btn-primary" onClick={request} disabled={saving}>{saving ? t('ag.wallet.sending') : t('ag.wallet.sendRequest')}</button>
        </div>
      </Modal>
    </div>
  );
}
