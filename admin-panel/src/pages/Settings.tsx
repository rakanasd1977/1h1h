import { useEffect, useState } from 'react';
import { api } from '../api';
import { useToast, PageLoading, Toggle } from '@rafidain/shared/ui';
import { PageHead } from '@rafidain/shared/ui';
import { t } from '@rafidain/shared/i18n';
import { useLocale } from '@rafidain/shared';

export default function Settings() {
  useLocale();
  const SETTING_GROUPS = {
    general: { label: t('ad.settings.groupGeneral'), icon: '⚙️', keys: ['app_name', 'currency', 'about_us', 'support_phone', 'app_base_url'] },
    mail: { label: t('ad.settings.groupMail'), icon: '📧', keys: ['smtp_enabled', 'smtp_host', 'smtp_port', 'smtp_secure', 'smtp_user', 'smtp_pass', 'smtp_from'] },
    sms: { label: t('ad.settings.groupSms'), icon: '💬', keys: ['sms_enabled', 'sms_provider', 'sms_base_url', 'sms_api_key', 'sms_api_secret', 'sms_sender'] },
    commissions: { label: t('ad.settings.groupCommissions'), icon: '💰', keys: ['agent_default_commission', 'platform_commission_default', 'provider_free_orders'] },
    promos: { label: t('ad.settings.groupPromos'), icon: '📢', keys: ['promo_price', 'promo_duration_days', 'promo_max_active'] },
    shipping: { label: t('ad.settings.groupShipping'), icon: '🚚', keys: ['free_shipping_min'] },
    loyalty: { label: t('ad.settings.groupLoyalty'), icon: '🎁', keys: ['loyalty_point_value', 'loyalty_min_redeem', 'loyalty_earn_per_1000', 'referral_bonus_referrer', 'referral_bonus_referee', 'referral_min_order'] },
    coupons: { label: t('ad.settings.groupCoupons'), icon: '🎫', keys: ['provider_coupon_max_percent', 'provider_coupon_max_fixed'] },
    payments: { label: t('ad.settings.groupPayments'), icon: '🏦', keys: ['al_ahli_bank_name', 'al_ahli_bank_iban', 'first_iraqi_bank_name', 'first_iraqi_bank_iban', 'zain_cash_number', 'asia_pay_number', 'recharge_instructions'] },
    system: { label: t('ad.settings.groupSystem'), icon: '🔒', keys: ['require_provider_verification', 'require_agent_lease', 'activity_log_retention_days'] },
  };

  const SETTING_META = {
    app_name: { type: 'text', label: t('ad.settings.appName'), required: true },
    currency: { type: 'text', label: t('ad.settings.currency'), required: true },
    about_us: { type: 'textarea', label: t('ad.settings.aboutUs'), rows: 3 },
    support_phone: { type: 'tel', label: t('ad.settings.supportPhone') },
    app_base_url: { type: 'text', label: t('ad.settings.appBaseUrl') },
    smtp_enabled: { type: 'boolean', label: t('ad.settings.smtpEnabled') },
    smtp_host: { type: 'text', label: t('ad.settings.smtpHost') },
    smtp_port: { type: 'number', label: t('ad.settings.smtpPort'), min: 1, max: 65535 },
    smtp_secure: { type: 'boolean', label: t('ad.settings.smtpSecure') },
    smtp_user: { type: 'text', label: t('ad.settings.smtpUser') },
    smtp_pass: { type: 'password', label: t('ad.settings.smtpPass') },
    smtp_from: { type: 'text', label: t('ad.settings.smtpFrom') },
    sms_enabled: { type: 'boolean', label: t('ad.settings.smsEnabled') },
    sms_provider: { type: 'text', label: t('ad.settings.smsProvider') },
    sms_base_url: { type: 'text', label: t('ad.settings.smsBaseUrl') },
    sms_api_key: { type: 'password', label: t('ad.settings.smsApiKey') },
    sms_api_secret: { type: 'password', label: t('ad.settings.smsApiSecret') },
    sms_sender: { type: 'text', label: t('ad.settings.smsSender') },
    agent_default_commission: { type: 'number', label: t('ad.settings.agentDefaultCommission'), min: 0, max: 100, step: 0.1 },
    platform_commission_default: { type: 'number', label: t('ad.settings.platformCommissionDefault'), min: 0, max: 100, step: 0.1 },
    provider_free_orders: { type: 'number', label: t('ad.settings.providerFreeOrders'), min: 0, max: 1000, step: 1 },
    promo_price: { type: 'number', label: t('ad.settings.promoPrice'), min: 0, step: 1000 },
    promo_duration_days: { type: 'number', label: t('ad.settings.promoDurationDays'), min: 1, max: 365 },
    promo_max_active: { type: 'number', label: t('ad.settings.promoMaxActive'), min: 1, max: 100 },
    free_shipping_min: { type: 'number', label: t('ad.settings.freeShippingMin'), min: 0, step: 1000 },
    loyalty_point_value: { type: 'number', label: t('ad.settings.loyaltyPointValue'), min: 1, step: 1 },
    loyalty_min_redeem: { type: 'number', label: t('ad.settings.loyaltyMinRedeem'), min: 1, step: 1 },
    loyalty_earn_per_1000: { type: 'number', label: t('ad.settings.loyaltyEarnPer1000'), min: 0, step: 1 },
    referral_bonus_referrer: { type: 'number', label: t('ad.settings.referralBonusReferrer'), min: 0, step: 1 },
    referral_bonus_referee: { type: 'number', label: t('ad.settings.referralBonusReferee'), min: 0, step: 1 },
    referral_min_order: { type: 'number', label: t('ad.settings.referralMinOrder'), min: 0, step: 1000 },
    provider_coupon_max_percent: { type: 'number', label: t('ad.settings.providerCouponMaxPercent'), min: 0, max: 100, step: 1 },
    provider_coupon_max_fixed: { type: 'number', label: t('ad.settings.providerCouponMaxFixed'), min: 0, step: 1000 },
    al_ahli_bank_name: { type: 'text', label: t('ad.settings.alAhliName') },
    al_ahli_bank_iban: { type: 'text', label: t('ad.settings.alAhliIban') },
    first_iraqi_bank_name: { type: 'text', label: t('ad.settings.firstIraqiName') },
    first_iraqi_bank_iban: { type: 'text', label: t('ad.settings.firstIraqiIban') },
    zain_cash_number: { type: 'textarea', label: t('ad.settings.zainCashNumber'), rows: 2 },
    asia_pay_number: { type: 'textarea', label: t('ad.settings.asiaPayNumber'), rows: 2 },
    recharge_instructions: { type: 'textarea', label: t('ad.settings.rechargeInstructions'), rows: 3 },
    require_agent_lease: { type: 'boolean', label: t('ad.settings.requireAgentLease') },
    require_provider_verification: { type: 'boolean', label: t('ad.settings.requireProviderVerification') },
    activity_log_retention_days: { type: 'number', label: t('ad.settings.activityLogRetentionDays'), min: 1, max: 3650 },
  };

  const TYPE_LABELS = {
    text: t('ad.settings.typeText'), number: t('ad.settings.typeNumber'), boolean: t('ad.settings.typeBoolean'), textarea: t('ad.settings.typeTextarea'), tel: t('ad.settings.typeTel'),
  };
  const [settings, setSettings] = useState<any>({});
  const [saving, setSaving] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const load = async () => {
    try {
      const res = await api.get('/settings');
      setSettings(res.data || {});
      setLoading(false);
    } catch (e: any) { toast.error(e.message); setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleChange = (key: any, value: any) => {
    setSettings((prev: any) => ({ ...prev, [key]: { ...(prev[key] || {}), value } }));
  };

  const handleSave = async (key: any) => {
    const entry = settings[key];
    const value = entry && entry.value !== undefined ? entry.value : entry;
    const meta = (SETTING_META as any)[key];
    const label = meta?.label || key;
    setSaving((prev: any) => ({ ...prev, [key]: true }));
    try {
      await api.put(`/settings/${key}`, { value, label });
      toast.success(t('ad.settings.saved', { label }));
      setSaving((prev: any) => ({ ...prev, [key]: false }));
    } catch (e: any) {
      toast.error(e.message);
      setSaving((prev: any) => ({ ...prev, [key]: false }));
    }
  };

  if (loading) return <PageLoading />;

  return (
    <div>
      <PageHead title={t('ad.settings.title')} subtitle={t('ad.settings.subtitle')} />

      <div className="grid grid-2 gap-md">
        {Object.entries(SETTING_GROUPS).map(([groupKey, group]) => (
          <div key={groupKey} className="card">
            <div className="card-header flex-between">
              <h3>{group.icon} {group.label}</h3>
              <span className="badge badge-gray">{group.keys.length} {t('ad.settings.countSuffix')}</span>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {group.keys.map(key => {
                const meta = (SETTING_META as any)[key];
                const current = settings[key];
                if (!meta || !current) return null;
                const isSaving = saving[key];

                return (
                  <div key={key} className="field" style={{ margin: 0 }}>
                    <label>{meta.label} {meta.required && <span className="req">*</span>}</label>
                    {meta.type === 'boolean' ? (
                      <Toggle
                        checked={current?.value === '1' || current?.value === 'true'}
                        onChange={v => handleChange(key, v ? '1' : '0')}
                      />
                    ) : meta.type === 'textarea' ? (
                      <textarea
                        value={current?.value || ''}
                        onChange={e => handleChange(key, e.target.value)}
                        rows={meta.rows || 3}
                        className="input"
                        style={{ width: '100%', fontFamily: 'inherit' }}
                      />
                    ) : meta.type === 'number' ? (
                      <input
                        type="number"
                        value={current?.value || ''}
                        onChange={e => handleChange(key, e.target.value)}
                        min={meta.min}
                        max={meta.max}
                        step={meta.step || 1}
                        className="input"
                        style={{ width: '100%' }}
                      />
                    ) : (
                      <input
                        type={meta.type}
                        value={current?.value || ''}
                        onChange={e => handleChange(key, e.target.value)}
                        placeholder={meta.type === 'password' ? t('ad.settings.passwordPlaceholder') : undefined}
                        className="input"
                        style={{ width: '100%' }}
                      />
                    )}
                    <div className="flex gap-sm items-center" style={{ marginTop: 8 }}>
                      <button
                        className={`btn btn-primary ${isSaving ? 'btn-disabled' : ''}`}
                        onClick={() => handleSave(key)}
                        disabled={isSaving}
                      >
                        {isSaving ? t('ad.settings.saving') : `💾 ${t('ad.settings.saveBtn')}`}
                      </button>
                      <span className="muted mono" style={{ fontSize: 11 }}>{t('ad.settings.keyLabel')}: {key}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}