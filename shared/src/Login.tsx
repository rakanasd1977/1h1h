import { useState, type FormEvent, type ReactNode } from 'react';
import { useToast, Field } from './ui';
import { t } from './i18n';
import { useLocale } from './LanguageSwitcher';

export interface LoginProps {
  login: (email: string, password: string) => Promise<any>;
  verify2fa: (twofaToken: string, code: string) => Promise<any>;
  logo?: string;
  subtitle: string;
  emailPlaceholder?: string;
  buttonLabel: string;
  onLoginSuccess: (user: any) => void;
  footerNote?: ReactNode;
}

export function Login({ login, verify2fa, logo = '🛒', subtitle, emailPlaceholder, buttonLabel, onLoginSuccess, footerNote }: LoginProps) {
  const toast = useToast();
  useLocale();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [twofaToken, setTwofaToken] = useState<any>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await login(email, password);
      if (res && res.requires_2fa) {
        setTwofaToken(res.twofa_token);
        return;
      }
      onLoginSuccess(res);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const submitCode = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await verify2fa(twofaToken, code);
      onLoginSuccess(user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">{logo}</div>
        <h1>سوق الرافدين</h1>
        <div className="login-sub">{subtitle}</div>

        {error && <div className="alert-error">{error}</div>}

        {twofaToken ? (
          <form onSubmit={submitCode}>
            <Field label={t('login.2fa')} required hint={t('login.2faHint')}>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="••••••"
                required
              />
            </Field>
            <button className="btn btn-primary" style={{ width: '100%', marginTop: 8 }} disabled={loading}>
              {loading ? t('login.verifying') : t('login.confirm2fa')}
            </button>
          </form>
        ) : (
          <form onSubmit={submit}>
            <Field label={t('login.email')} required>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={emailPlaceholder}
                autoComplete="username"
                required
              />
            </Field>
            <Field label={t('login.password')} required>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
            </Field>
            <button className="btn btn-primary" style={{ width: '100%', marginTop: 8 }} disabled={loading}>
              {loading ? t('login.signingIn') : buttonLabel}
            </button>
          </form>
        )}

        {footerNote && <div className="login-sub" style={{ marginTop: 16 }}>{footerNote}</div>}
      </div>
    </div>
  );
}
