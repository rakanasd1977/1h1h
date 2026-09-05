import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { Login as LoginScreen, useToast } from '@rafidain/shared/ui';
import { SERVICES, CATALOGS } from '../catalog';
import { t } from '@rafidain/shared/i18n';

export default function Login() {
  const { login, verify2fa } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  return (
    <LoginScreen
      login={login}
      verify2fa={verify2fa}
      logo="🏪"
      subtitle={t('pr.login.subtitle')}
      emailPlaceholder="provider.demo@rafidain.iq"
      buttonLabel={t('pr.login.buttonLabel')}
      onLoginSuccess={(u: any) => {
        const cat = (CATALOGS as Record<string, any>)[u.service_type];
        toast.success(
          t('pr.login.welcomeToast', { name: u.provider_name, title: t(cat?.title || (SERVICES as Record<string, any>)[u.service_type]?.name || 'pr.layout.brandSubtitle') })
        );
        navigate('/');
      }}
      footerNote={t('pr.login.footerNote')}
    />
  );
}
