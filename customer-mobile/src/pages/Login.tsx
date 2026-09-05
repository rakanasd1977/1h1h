import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Toast } from '../components/Toast';
import { Spinner } from '../components/Spinner';
import { useAppName } from '@rafidain/shared/ui';
import { useLocale, t } from '@rafidain/shared';

export default function Login() {
  useLocale();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next') || '';
  const appName = useAppName();

  useEffect(() => { document.title = appName; }, [appName]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: any) => {
    e.preventDefault();
    setBusy(true);
    setToast('');
    try {
      await login(email, password);
      navigate(next ? next : '/');
    } catch (err: any) {
      setToast(err.message || t('auth.loginFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'linear-gradient(120deg, var(--brand), var(--brand2))' }}>
      <div style={{ padding: '28px 20px 70px', color: '#fff' }}>
        <div style={{ fontSize: 28, fontWeight: 800 }}>{appName}</div>
        <div style={{ fontSize: 13, opacity: 0.92, marginTop: 4 }}>{t('auth.loginSubtitle')}</div>
      </div>
      <div style={{ padding: '0 20px', marginTop: -30 }}>
        <form className="card" style={{ padding: 20 }} onSubmit={submit}>
          <div className="field">
            <label>{t('auth.email')}</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div className="field">
            <label>{t('auth.password')}</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            <div style={{ textAlign: 'right', marginTop: 6, fontSize: 13 }}>
              <Link to="/forgot-password" className="muted" style={{ color: 'var(--brand)', fontWeight: 600 }}>{t('auth.forgotPassword')}</Link>
            </div>
          </div>
          <button className="btn btn--primary btn--lg" disabled={busy} type="submit">
            {busy ? <Spinner /> : t('auth.login')}
          </button>
          <div style={{ textAlign: 'center', marginTop: 14, fontSize: 13 }}>
            <span className="muted">{t('auth.noAccount')} </span>
            <Link to={`/register${next ? `?next=${next}` : ''}`} style={{ color: 'var(--brand)', fontWeight: 700 }}>{t('auth.createAccount')}</Link>
          </div>
        </form>
      </div>
      <Toast message={toast} onClose={() => setToast('')} />
    </div>
  );
}
