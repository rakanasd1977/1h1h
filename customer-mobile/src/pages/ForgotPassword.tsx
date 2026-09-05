import { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAppName } from '@rafidain/shared/ui';
import { useLocale, t } from '@rafidain/shared';
import { authApi } from '../api';
import { Toast } from '../components/Toast';
import { Spinner } from '../components/Spinner';

// استرجاع كلمة السر: الخطوة 1 طلب رمز استرجاع، الخطوة 2 إدخال الرمز مع كلمة مرور جديدة.
export default function ForgotPassword() {
  useLocale();
  const appName = useAppName();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [token, setToken] = useState(params.get('token') || '');
  const [password, setPassword] = useState('');
  const [step, setStep] = useState(params.get('token') ? 2 : 1);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');

  const requestCode = async (e: any) => {
    e.preventDefault();
    if (!email) {
      setToast(t('auth.forgotEmailRequired'));
      return;
    }
    setBusy(true);
    setToast('');
    try {
      const res: any = await authApi.forgotPassword(email);
      if (res && res.verification_token) setToken(res.verification_token);
      setStep(2);
    } catch (err: any) {
      setToast(err.message || t('auth.forgotFailed'));
    } finally {
      setBusy(false);
    }
  };

  const confirmReset = async (e: any) => {
    e.preventDefault();
    if (!token) {
      setToast(t('auth.resetCodeRequired'));
      return;
    }
    if (password.length < 6) {
      setToast(t('auth.newPasswordShort'));
      return;
    }
    setBusy(true);
    setToast('');
    try {
      await authApi.confirmResetPassword(token.trim(), password);
      navigate('/login');
    } catch (err: any) {
      setToast(err.message || t('auth.resetFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'linear-gradient(120deg, var(--brand), var(--brand2))' }}>
      <div style={{ padding: '28px 20px 70px', color: '#fff' }}>
        <div style={{ fontSize: 28, fontWeight: 800 }}>{appName}</div>
        <div style={{ fontSize: 13, opacity: 0.92, marginTop: 4 }}>{t('auth.forgotTitle')}</div>
      </div>
      <div style={{ padding: '0 20px', marginTop: -30 }}>
        <form className="card" style={{ padding: 20 }} onSubmit={step === 1 ? requestCode : confirmReset}>
          {step === 1 ? (
            <>
              <p className="muted" style={{ fontSize: 13, lineHeight: 1.7, marginBottom: 14 }}>
                {t('auth.forgotIntro')}
              </p>
              <div className="field">
                <label>{t('auth.email')}</label>
                <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
              </div>
              <button className="btn btn--primary btn--lg" disabled={busy} type="submit">
                {busy ? <Spinner /> : t('auth.sendResetCode')}
              </button>
            </>
          ) : (
            <>
              <p className="muted" style={{ fontSize: 13, lineHeight: 1.7, marginBottom: 14 }}>
                {t('auth.resetIntro')}
              </p>
              <div
                style={{
                  margin: '10px 0 14px',
                  padding: 12,
                  background: 'var(--surface2)',
                  border: '1px dashed var(--brand2)',
                  borderRadius: 10,
                  fontFamily: 'monospace',
                  direction: 'ltr',
                  fontSize: 13,
                  wordBreak: 'break-all',
                }}
              >
                {token || '—'}
              </div>
              <div className="field">
                <label>{t('auth.newPassword')}</label>
                <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
              </div>
              <button className="btn btn--primary btn--lg" disabled={busy} type="submit">
                {busy ? <Spinner /> : t('auth.setPasswordCta')}
              </button>
            </>
          )}
          <div style={{ textAlign: 'center', marginTop: 14, fontSize: 13 }}>
            <span className="muted">{t('auth.rememberedPassword')} </span>
            <Link to="/login" style={{ color: 'var(--brand)', fontWeight: 700 }}>{t('auth.backToLogin')}</Link>
          </div>
        </form>
      </div>
      <Toast message={toast} onClose={() => setToast('')} />
    </div>
  );
}