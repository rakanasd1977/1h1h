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
      logo="🤝"
      subtitle={t('ag.login.subtitle')}
      emailPlaceholder="agent.baghdad@rafidain.iq"
      buttonLabel={t('ag.login.buttonLabel')}
      onLoginSuccess={(res: any) => { toast.success(t('ag.login.welcomeToast', { name: res?.governorate_name_ar || '' })); navigate('/'); }}
    />
  );
}
