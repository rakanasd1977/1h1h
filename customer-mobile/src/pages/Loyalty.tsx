import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { customerApi } from '../api';
import { formatPrice, timeAgo } from '../format';
import { PageHeader } from '../components/PageHeader';
import { Spinner } from '../components/Spinner';
import { useLocale, t } from '@rafidain/shared';

const TIERS = [
  { key: 'platinum', nameKey: 'loyalty.tier.platinum', icon: '💎' },
  { key: 'gold', nameKey: 'loyalty.tier.gold', icon: '🥇' },
  { key: 'silver', nameKey: 'loyalty.tier.silver', icon: '🥈' },
  { key: 'bronze', nameKey: 'loyalty.tier.bronze', icon: '🥉' },
];

const TYPE_LABEL: Record<string, string> = {
  earn: 'loyalty.type.earn',
  redeem: 'loyalty.type.redeem',
  referral: 'loyalty.type.referral',
};

export default function Loyalty() {
  useLocale();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState(false);

  const load = () => {
    if (!user) return;
    setError(false);
    setData(null);
    customerApi.loyalty().then(setData).catch(() => setError(true));
  };

  useEffect(load, [user]);

  if (!user) {
    return (
      <div>
        <PageHeader title={t('loyalty.title')} />
        <div className="empty">
          <div className="empty__icon">🔐</div>
          <div className="empty__title">{t('loyalty.loginTitle')}</div>
          <button className="btn btn--primary" onClick={() => navigate('/login?next=loyalty')} type="button">{t('favorites.loginBtn')}</button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <PageHeader title={t('loyalty.title')} />
        <div className="empty">
          <div className="empty__icon">⚠️</div>
          <div className="empty__title">{t('loyalty.errorTitle')}</div>
          <div className="empty__sub">{t('loyalty.errorSub')}</div>
          <button className="btn btn--primary" onClick={load} type="button">{t('loyalty.retry')}</button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div>
        <PageHeader title={t('loyalty.title')} />
        <div className="centerpad"><Spinner /></div>
      </div>
    );
  }

  const tier = data.tier;
  const nextTier = data.next_tier;
  const progress = nextTier && data.points_total < nextTier.min
    ? Math.min(100, Math.round(((data.points_total - tier.min) / (nextTier.min - tier.min)) * 100))
    : 100;

  return (
    <div>
      <PageHeader title={t('loyalty.title')} />
      <div className="page page--no-nav">
        <div className="card" style={{ padding: 18, marginBottom: 14, background: 'linear-gradient(135deg,#1a1a2e,#16213e)', color: '#fff' }}>
          <div className="row row--between" style={{ marginBottom: 6 }}>
            <span style={{ fontSize: 13, opacity: 0.85 }}>{t('loyalty.balance')}</span>
            <span style={{ fontSize: 13, opacity: 0.85 }}>{tier.icon} {t(tier.name_key || tiersName(tier.key))}</span>
          </div>
          <div style={{ fontSize: 30, fontWeight: 900 }}>{data.points_balance} <span style={{ fontSize: 16, fontWeight: 700 }}>⭐</span></div>
          <div className="muted" style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>{t('loyalty.pointValue', { price: formatPrice(data.point_value) })}</div>
          <div className="progress" style={{ height: 8, borderRadius: 8, background: 'rgba(255,255,255,0.2)', overflow: 'hidden', marginTop: 12 }}>
            <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg,#f5a623,#ff6b00)', borderRadius: 8 }} />
          </div>
          <div style={{ fontSize: 11, marginTop: 6, opacity: 0.85 }}>
            {nextTier
              ? t('loyalty.remaining', { count: nextTier.min - data.points_total, tier: `${nextTier.icon} ${t(nextTier.name_key || tiersName(nextTier.key))}` })
              : t('loyalty.maxTier')}
          </div>
          <Link to="/checkout" style={{ display: 'inline-block', marginTop: 12, background: '#fff', color: '#16213e', fontWeight: 800, fontSize: 13, padding: '8px 14px', borderRadius: 10 }}>
            {t('loyalty.redeemNow')}
          </Link>
        </div>

        <div className="card" style={{ padding: 14, marginBottom: 14 }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>{t('loyalty.tiers')}</div>
          <div className="row" style={{ gap: 8 }}>
            {TIERS.map((tr) => (
              <div
                key={tr.key}
                className="card"
                style={{
                  flex: 1,
                  textAlign: 'center',
                  padding: '10px 4px',
                  border: data.tier.key === tr.key ? '2px solid #f5a623' : 'none',
                }}
              >
                <div style={{ fontSize: 20 }}>{tr.icon}</div>
                <div style={{ fontWeight: 700, fontSize: 12 }}>{t(tr.nameKey)}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ padding: 0 }}>
          <div style={{ fontWeight: 800, padding: '12px 14px', borderBottom: '1px solid var(--border, #eef1f5)' }}>{t('loyalty.history')}</div>
          {data.history.length === 0 ? (
            <div className="muted" style={{ padding: 16, textAlign: 'center' }}>{t('loyalty.noHistory')}</div>
          ) : (
            data.history.map((h: any) => (
              <div key={h.id} className="order-item row row--between">
                <span className="grow">
                  <span className="row row--between">
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{h.description || t(TYPE_LABEL[h.type] || h.type)}</span>
                    <span className="muted" style={{ fontSize: 11 }}>{timeAgo(h.created_at)}</span>
                  </span>
                  {h.order_number && <span className="muted" style={{ fontSize: 11 }}>{t('loyalty.order', { number: h.order_number })}</span>}
                </span>
                <span style={{ fontWeight: 800, color: h.type === 'redeem' ? '#ff3b30' : '#00a650' }}>
                  {h.type === 'redeem' ? '' : '+'}{h.points} ⭐
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function tiersName(key: string): string {
  const found = TIERS.find((x) => x.key === key);
  return found ? found.nameKey : 'loyalty.tier.bronze';
}
