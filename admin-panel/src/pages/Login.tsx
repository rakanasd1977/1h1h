import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { Login as LoginScreen, useToast } from '@rafidain/shared/ui';
import { t } from '@rafidain/shared/i18n';
import { useLocale } from '@rafidain/shared';

export default function Login() {
  useLocale();
  const { login, verify2fa } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  return (
    <LoginScreen
      login={login}
      verify2fa={verify2fa}
      logo="🛒"
      subtitle={t('ad.login.subtitle')}
      emailPlaceholder="admin@rafidain.iq"
      buttonLabel={t('ad.login.buttonLabel')}
      onLoginSuccess={() => { toast.success(t('ad.login.welcomeToast')); navigate('/'); }}
    />
  );
}
