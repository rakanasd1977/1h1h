import { useAuth } from '../auth';
import { TwoFactorManager, ChangePasswordForm, NotificationPreferencesForm } from '@rafidain/shared/ui';
import { api } from '../api';
import { PageHead } from '@rafidain/shared/ui';
import { t } from '@rafidain/shared/i18n';
import { useLocale } from '@rafidain/shared';

export default function Profile() {
  useLocale();
  const { user, reload } = useAuth();

  return (
    <div>
      <PageHead title={t('ad.profile.title')} subtitle={t('ad.profile.subtitle')} />

      <div className="grid grid-2">
        <div className="card">
          <div className="card-header"><h3>{t('ad.profile.accountInfo')}</h3></div>
          <div className="card-body">
            <div className="detail-grid">
              <div className="detail-item"><div className="k">{t('ad.profile.name')}</div><div className="v">{user?.name_ar}</div></div>
              <div className="detail-item"><div className="k">{t('ad.profile.email')}</div><div className="v" dir="ltr">{user?.email}</div></div>
              <div className="detail-item"><div className="k">{t('ad.profile.role')}</div><div className="v"><span className="badge badge-red">{t('ad.profile.platformAdmin')}</span></div></div>
              <div className="detail-item"><div className="k">{t('ad.profile.permissions')}</div><div className="v">{t('ad.profile.fullAccess')}</div></div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3>{t('ad.profile.changePassword')}</h3></div>
          <div className="card-body">
            <ChangePasswordForm api={api} />
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3>{t('ad.profile.twoFactorAuth')}</h3></div>
          <div className="card-body">
            <TwoFactorManager api={api} enabled={!!user?.totp_enabled} onChanged={() => reload()} />
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3>{t('ad.profile.notifPrefs')}</h3></div>
          <div className="card-body">
            <NotificationPreferencesForm api={api} />
          </div>
        </div>
      </div>
    </div>
  );
}
