import { useEffect, useState } from 'react';
import { api } from '../api';
import { useToast, fmt, fmtDate, PageLoading, Badge, LEASE_STATUS, Confirm } from '@rafidain/shared/ui';
import type { LeaseData } from '../types';
import { PageHead } from '@rafidain/shared/ui';
import { t } from '@rafidain/shared/i18n';
import { useLocale } from '@rafidain/shared';

export default function Lease() {
  useLocale();
  const [data, setData] = useState<LeaseData | null>(null);
  const [confirmRenew, setConfirmRenew] = useState(false);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const load = () => api.get('/agent/lease').then((r) => setData(r.data)).catch((e) => toast.error(e.message));
  useEffect(() => { load(); }, []);

  const renew = async () => {
    setSaving(true);
    try {
      const res = await api.post('/agent/lease/renew');
      toast.success(res.data.message);
      setConfirmRenew(false);
      load();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  if (!data) return <PageLoading />;

  const hasPending = data.payments?.some((p) => p.status === 'pending');
  const scopeName = data.district_name_ar ? t('ag.lease.scopeDistrict', { name: data.district_name_ar }) : t('ag.lease.scopeGov', { name: data.governorate_name_ar ?? '' });
  const scopeHint = data.district_name_ar ? t('ag.lease.scopeHintDistrict') : t('ag.lease.scopeHintGov');

  return (
    <div>
      <PageHead title={t('ag.lease.title', { name: scopeName })} subtitle={t('ag.lease.subtitle', { hint: scopeHint })} />

      {data.is_expired && <div className="alert-error mb-4">{t('ag.lease.expiredAlert')}</div>}
      {hasPending && <div className="alert-info mb-4">{t('ag.lease.pendingAlert')}</div>}

      <div className="grid grid-2 mb-4">
        <div className="card">
          <div className="card-header"><h3>{t('ag.lease.myLeaseInfo')}</h3></div>
          <div className="card-body">
            <div className="detail-grid">
              <div className="detail-item"><div className="k">{data.district_name_ar ? t('ag.lease.district') : t('ag.lease.governorate')}</div><div className="v">{data.district_name_ar || data.governorate_name_ar}</div></div>
              <div className="detail-item"><div className="k">{t('ag.lease.leaseStatus')}</div><div className="v"><Badge status={data.lease_status} map={LEASE_STATUS} /></div></div>
              <div className="detail-item"><div className="k">{t('ag.lease.expiryDate')}</div><div className="v">{fmtDate(data.lease_expires_at)}</div></div>
              <div className="detail-item"><div className="k">{t('ag.lease.annualRenewalFee')}</div><div className="v">{fmt(data.lease_fee)} {t('ag.lease.dinar')}</div></div>
              <div className="detail-item"><div className="k">{t('ag.lease.yourCommRate')}</div><div className="v">%{data.commission_rate}</div></div>
            </div>
            <button className="btn btn-accent mt-4" disabled={hasPending} onClick={() => setConfirmRenew(true)}>
              {hasPending ? t('ag.lease.renewPending') : t('ag.lease.renewBtn')}
            </button>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3>{t('ag.lease.paymentHistory')}</h3></div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>{t('ag.lease.th.number')}</th><th>{t('ag.lease.th.amount')}</th><th>{t('ag.lease.th.period')}</th><th>{t('ag.lease.th.status')}</th><th>{t('ag.lease.th.paidAt')}</th></tr>
              </thead>
              <tbody>
                {data.payments.length === 0 && <tr><td colSpan={5}><div className="muted" style={{ padding: 16 }}>{t('ag.lease.noPayments')}</div></td></tr>}
                {data.payments.map((p) => (
                  <tr key={p.id}>
                    <td>{p.id}</td>
                    <td className="bold">{fmt(p.amount)}</td>
                    <td className="muted" style={{ fontSize: 12 }}>
                      {fmtDate(p.period_start)} ← {fmtDate(p.period_end)}
                    </td>
                    <td>
                      {p.status === 'paid' && <span className="badge badge-green">{t('ag.lease.paid')}</span>}
                      {p.status === 'pending' && <span className="badge badge-amber">{t('ag.lease.pendingStatus')}</span>}
                      {p.status === 'rejected' && <span className="badge badge-red">{t('ag.lease.rejected')}</span>}
                    </td>
                    <td className="muted">{p.paid_at ? fmtDate(p.paid_at) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Confirm
        open={confirmRenew}
        title={t('ag.lease.renewConfirmTitle')}
        message={t('ag.lease.renewConfirmMsg', { name: scopeName, fee: fmt(data.lease_fee) })}
        confirmText={t('ag.lease.confirmSendRequest')}
        onConfirm={renew}
        onCancel={() => setConfirmRenew(false)}
      />
    </div>
  );
}
