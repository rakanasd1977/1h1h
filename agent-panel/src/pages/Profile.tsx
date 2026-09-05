import { useAuth } from '../auth';
import { TwoFactorManager, fmt, ChangePasswordForm, NotificationPreferencesForm } from '@rafidain/shared/ui';
import { api } from '../api';
import { PageHead } from '@rafidain/shared/ui';
import { t } from '@rafidain/shared/i18n';
import { useLocale } from '@rafidain/shared';

export default function Profile() {
  useLocale();
  const { user } = useAuth();

  return (
    <div>
      <PageHead title={t('ag.profile.title')} subtitle={t('ag.profile.subtitle')} />

      <div className="grid grid-2">
        <div className="card">
          <div className="card-header"><h3>{t('ag.profile.accountInfo')}</h3></div>
          <div className="card-body">
            <div className="detail-grid">
              <div className="detail-item"><div className="k">{t('ag.profile.name')}</div><div className="v">{user?.name_ar}</div></div>
              <div className="detail-item"><div className="k">{t('ag.profile.email')}</div><div className="v" dir="ltr">{user?.email}</div></div>
              <div className="detail-item"><div className="k">{t('ag.profile.role')}</div><div className="v"><span className="badge badge-red">{t('ag.profile.agentRole')}</span></div></div>
              <div className="detail-item"><div className="k">{t('ag.profile.governorate')}</div><div className="v"><span className="badge badge-teal">{user?.governorate_name_ar}</span></div></div>
              <div className="detail-item"><div className="k">{t('ag.profile.commissionRate')}</div><div className="v">%{user?.agent_commission_rate}</div></div>
              <div className="detail-item"><div className="k">{t('ag.profile.leaseFees')}</div><div className="v">{fmt(user?.lease_fee)} {t('ag.profile.dinar')}</div></div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3>{t('ag.profile.changePassword')}</h3></div>
          <div className="card-body">
            <ChangePasswordForm api={api} />
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3>{t('ag.profile.twoFactorAuth')}</h3></div>
          <div className="card-body">
            <TwoFactorManager api={api} enabled={!!user?.totp_enabled} onChanged={() => {}} />
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3>{t('ag.profile.notifPrefs')}</h3></div>
          <div className="card-body">
            <NotificationPreferencesForm api={api} />
          </div>
        </div>
      </div>
    </div>
  );
}
