import { useEffect, useState } from 'react';
import { api } from '../api';
import { PageLoading, EmptyState, Badge, PageHead } from '@rafidain/shared/ui';
import { t } from '@rafidain/shared/i18n';
import { useLocale } from '@rafidain/shared';

const TYPE_LABEL: Record<string, string> = {
  wallet: 'محفظة',
  card: 'بطاقة',
  bank_transfer: 'تحويل بنكي',
  fintech: 'تقنية مالية',
};

export default function PaymentGateways() {
  useLocale();
  const [rows, setRows] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/payments')
      .then((r: any) => setRows(Array.isArray(r) ? r : (r?.data || [])))
      .catch((e: any) => { setRows([]); setError(e.message); });
  }, []);

  if (!rows) return <PageLoading />;

  return (
    <div>
      <PageHead title={t('ad.payments.title')} subtitle={t('ad.payments.subtitle')} />
      <div className="card">
        <div className="table-wrap">
          {error ? <EmptyState text={error} icon="⚠️" /> : rows.length === 0 ? (
            <EmptyState text={t('ad.payments.empty')} icon="💳" />
          ) : (
            <table>
              <thead>
                <tr>
                  <th>#</th><th>{t('ad.payments.name')}</th><th>{t('ad.payments.type')}</th>
                  <th>{t('ad.payments.status')}</th><th>{t('ad.payments.mode')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((g: any, i: number) => (
                  <tr key={g.code}>
                    <td className="mono muted">{i + 1}</td>
                    <td className="bold">
                      {g.name_ar || g.code}
                      <div className="muted" style={{ fontSize: 12 }}>{g.name_en || g.code}</div>
                    </td>
                    <td className="muted">{TYPE_LABEL[g.type] || g.type}</td>
                    <td>
                      <Badge status={g.is_active ? 'active' : 'disabled'}
                        map={{ active: { label: t('ad.payments.active'), cls: 'badge-green' }, disabled: { label: t('ad.payments.disabled'), cls: 'badge-gray' } }} />
                    </td>
                    <td className="muted">{g.sandbox ? t('ad.payments.sandbox') : t('ad.payments.live')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="muted" style={{ padding: '10px 14px', fontSize: 13 }}>💡 {t('ad.payments.activateHint')}</div>
      </div>
    </div>
  );
}