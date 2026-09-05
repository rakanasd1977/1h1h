import { useEffect, useState } from 'react';
import { api } from '../api';
import { useToast, Field } from '@rafidain/shared/ui';
import { PageHead } from '@rafidain/shared/ui';
import { t } from '@rafidain/shared/i18n';
import { useLocale } from '@rafidain/shared';

export default function Commissions() {
  useLocale();
  const [data, setData] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => {
    api.get('/commissions').then((r) => setData(r.data)).catch((e) => toast.error(e.message));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const res = await api.put('/commissions', {
        platform_commission_default: data.platform_commission_default,
        agent_default_commission: data.agent_default_commission,
        currency: data.currency,
      });
      setData(res.data);
      toast.success(t('ad.comm.updated'));
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  if (!data) return <div className="page-loading"><div className="spinner" /></div>;

  return (
    <div>
      <PageHead title={t('ad.comm.title')} subtitle={t('ad.comm.subtitle')} />

      <div className="grid grid-2">
        <div className="card">
          <div className="card-header"><h3>{t('ad.comm.settings')}</h3></div>
          <div className="card-body">
            <div className="alert-info">{t('ad.comm.howItWorks')}</div>
            <Field label={t('ad.comm.platformDefault')} required>
              <input type="number" step="0.5" value={data.platform_commission_default} onChange={(e) => setData({ ...data, platform_commission_default: e.target.value })} />
            </Field>
            <Field label={t('ad.comm.agentDefault')} required>
              <input type="number" step="0.5" value={data.agent_default_commission} onChange={(e) => setData({ ...data, agent_default_commission: e.target.value })} />
            </Field>
            <Field label={t('ad.comm.currency')} required>
              <select value={data.currency} onChange={(e) => setData({ ...data, currency: e.target.value })}>
                <option value="IQD">IQD - {t('ad.comm.iqd')}</option>
                <option value="USD">USD - {t('ad.comm.usd')}</option>
              </select>
            </Field>
            <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? t('ad.common.saving') : t('ad.comm.saveBtn')}</button>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3>{t('ad.comm.example')}</h3></div>
          <div className="card-body">
            <p className="muted mb-3">{t('ad.comm.exampleIntro')}</p>
            {(() => {
              const pf = Number(data.platform_commission_default) || 0;
              const ag = Number(data.agent_default_commission) || 0;
              const total = 100000 * pf / 100;
              const agent = Math.min(100000 * ag / 100, total);
              const platform = total - agent;
              const provider = 100000 - total;
              return (
                <div className="detail-grid">
                  <div className="detail-item"><div className="k">{t('ad.comm.platformComm')}</div><div className="v">{Math.round(platform)} {t('ad.currency')}</div></div>
                  <div className="detail-item"><div className="k">{t('ad.comm.agentComm')}</div><div className="v">{Math.round(agent)} {t('ad.currency')}</div></div>
                  <div className="detail-item"><div className="k">{t('ad.comm.totalComm')}</div><div className="v">{Math.round(total)} {t('ad.currency')}</div></div>
                  <div className="detail-item"><div className="k">{t('ad.comm.providerShare')}</div><div className="v">{Math.round(provider)} {t('ad.currency')}</div></div>
                </div>
              );
            })()}
            <p className="muted mt-3" style={{ fontSize: 12 }}>⚠️ {t('ad.comm.perProviderNote')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
