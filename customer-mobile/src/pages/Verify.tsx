import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Toast } from '../components/Toast';
import { Spinner } from '../components/Spinner';
import { useLocale, t } from '@rafidain/shared';

export default function Verify() {
  useLocale();
  const { verifyEmail, resendVerification } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [token, setToken] = useState(params.get('token') || '');
  const email = params.get('email') || '';
  const next = params.get('next') || '';
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [toast, setToast] = useState('');

  const submit = async () => {
    if (!token) {
      setToast(t('auth.tokenMissing'));
      return;
    }
    setBusy(true);
    setToast('');
    try {
      await verifyEmail(token);
      navigate(next === 'checkout' ? '/checkout' : '/');
    } catch (err: any) {
      setToast(err.message || t('auth.verifyFailed'));
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setResending(true);
    setToast('');
    try {
      const res: any = await resendVerification({ token, email });
      if (res && res.verification_token) setToken(res.verification_token);
      setToast(t('auth.resent'));
    } catch (err: any) {
      setToast(err.message || t('auth.resendFailed'));
    } finally {
      setResending(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: 20, display: 'flex', flexDirection: 'column' }}>
      <div style={{ textAlign: 'center', paddingTop: 24 }}>
        <div style={{ fontSize: 52 }}>📧</div>
        <div style={{ fontSize: 20, fontWeight: 800, marginTop: 12 }}>{t('auth.verifyTitle')}</div>
        <p className="muted" style={{ marginTop: 8, lineHeight: 1.7 }}>
          {t('auth.verifyHint')}
        </p>
        <div
          style={{
            margin: '16px auto',
            padding: 14,
            background: 'var(--surface2)',
            border: '1px dashed var(--brand2)',
            borderRadius: 12,
            fontFamily: 'monospace',
            direction: 'ltr',
            fontSize: 13,
            wordBreak: 'break-all',
            maxWidth: 340,
          }}
        >
          {token || '—'}
        </div>
        <button className="btn btn--primary btn--lg" style={{ maxWidth: 340, margin: '0 auto' }} disabled={busy} onClick={submit} type="button">
          {busy ? <Spinner /> : t('auth.verifyCta')}
        </button>
        <div style={{ marginTop: 16 }}>
          <button className="btn btn--ghost" style={{ maxWidth: 340, margin: '0 auto' }} disabled={resending} onClick={resend} type="button">
            {resending ? <Spinner /> : t('auth.resend')}
          </button>
          <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
            {t('auth.verifyResendHint')}
          </p>
        </div>
      </div>
      <Toast message={toast} onClose={() => setToast('')} />
    </div>
  );
}
