import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { customerApi } from '../api';
import { formatPrice } from '../format';
import { PageHeader } from '../components/PageHeader';
import { Spinner } from '../components/Spinner';
import { Toast } from '../components/Toast';
import { useLocale, t } from '@rafidain/shared';

export default function Referral() {
  useLocale();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState(false);
  const [toast, setToast] = useState('');

  const load = () => {
    if (!user) return;
    setError(false);
    setData(null);
    customerApi.referral().then(setData).catch(() => setError(true));
  };

  useEffect(load, [user]);

  if (!user) {
    return (
      <div>
        <PageHeader title={t('referral.title')} />
        <div className="empty">
          <div className="empty__icon">🔐</div>
          <div className="empty__title">{t('loyalty.loginTitle')}</div>
          <button className="btn btn--primary" onClick={() => navigate('/login?next=referral')} type="button">{t('favorites.loginBtn')}</button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <PageHeader title={t('referral.title')} />
        <div className="empty">
          <div className="empty__icon">⚠️</div>
          <div className="empty__title">{t('referral.errorTitle')}</div>
          <div className="empty__sub">{t('loyalty.errorSub')}</div>
          <button className="btn btn--primary" onClick={load} type="button">{t('loyalty.retry')}</button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div>
        <PageHeader title={t('referral.title')} />
        <div className="centerpad"><Spinner /></div>
      </div>
    );
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(data.link);
      setToast(t('referral.copyLinkToast'));
    } catch (e: any) {
      setToast(data.link);
    }
  };

  const share = async () => {
    const text = t('referral.shareText', { link: data.link });
    if (navigator.share) {
      try {
        await navigator.share({ title: t('referral.shareTitle'), text });
        return;
      } catch (e: any) { /* user cancelled */ }
    }
    try {
      await navigator.clipboard.writeText(text);
      setToast(t('referral.copyTextToast'));
    } catch (e: any) { /* ignore */ }
  };

  return (
    <div>
      <PageHeader title={t('referral.title')} />
      <div className="page page--no-nav">
        <div className="card" style={{ padding: 18, marginBottom: 14, background: 'linear-gradient(135deg,#7b2ff7,#f107a3)', color: '#fff', textAlign: 'center' }}>
          <div style={{ fontSize: 40 }}>🎁</div>
          <div style={{ fontWeight: 900, fontSize: 19, marginTop: 6 }}>{t('referral.earn', { price: formatPrice(data.bonus_referrer) })}</div>
          <div className="muted" style={{ fontSize: 13, opacity: 0.9, marginTop: 4 }}>
            {t('referral.how', { price: formatPrice(data.min_order) })}
          </div>
        </div>

        <div className="card" style={{ padding: 14, marginBottom: 14 }}>
          <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{t('referral.yourCode')}</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <span style={{ fontWeight: 900, fontSize: 22, letterSpacing: 2, direction: 'ltr', color: 'var(--brand)' }}>{data.code}</span>
            <button className="btn btn--outline btn--sm" onClick={copy} type="button">{t('referral.copy')}</button>
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 6, direction: 'ltr', textAlign: 'center', wordBreak: 'break-all' }}>{data.link}</div>
          <button className="btn btn--primary btn--lg" style={{ marginTop: 12 }} onClick={share} type="button">{t('referral.share')}</button>
        </div>

        <div className="card" style={{ padding: 14, marginBottom: 14 }}>
          <div className="row row--between">
            <span style={{ fontWeight: 800 }}>{t('referral.invited')}</span>
            <span style={{ fontWeight: 800, color: 'var(--brand)' }}>{data.invited_count}</span>
          </div>
          <div className="row row--between" style={{ marginTop: 8 }}>
            <span className="muted">{t('referral.yourReward')}</span>
            <span style={{ fontWeight: 700, color: '#00a650' }}>+{formatPrice(data.bonus_referrer)} ⭐</span>
          </div>
          <div className="row row--between" style={{ marginTop: 6 }}>
            <span className="muted">{t('referral.friendReward')}</span>
            <span style={{ fontWeight: 700, color: '#00a650' }}>+{formatPrice(data.bonus_referee)} ⭐</span>
          </div>
        </div>

        <div className="card" style={{ padding: 14 }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>{t('referral.howWorks')}</div>
          <div className="muted" style={{ fontSize: 13, lineHeight: 1.9 }}>
            {t('referral.rule1')}<br />
            {t('referral.rule2')}<br />
            {t('referral.rule3', { price: formatPrice(data.min_order) })}<br />
            {t('referral.rule4')}
          </div>
        </div>
      </div>
      <Toast message={toast} onClose={() => setToast('')} />
    </div>
  );
}