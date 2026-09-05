import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { customerApi, api } from '../api';
import { formatCompact, formatDate } from '../format';
import { pushSupported } from '@rafidain/shared/push';
import { getLocale, setLocale, useLocale, t } from '@rafidain/shared';
import { NotificationPreferencesForm } from '@rafidain/shared/ui';
import { enablePush, disablePush } from '../push';

function MenuRow({ icon, label, onClick, value, danger = false }: { icon: any; label: string; onClick: () => void; value?: string; danger?: boolean }) {
  return (
    <button className={`menu-item${danger ? ' menu-item--danger' : ''}`} onClick={onClick} type="button">
      <span className="menu-item__icon">{icon}</span>
      <span className="grow">{label}</span>
      {value !== undefined && <span className="menu-item__value">{value}</span>}
      <span className="menu-item__chevron">‹</span>
    </button>
  );
}

function MenuGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="menu-group">
      <div className="menu-group__head">{title}</div>
      <div className="card">{children}</div>
    </div>
  );
}

export default function Profile() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  useLocale();
  const navigate = useNavigate();
  const [dash, setDash] = useState<any>(null);
  const [loyalty, setLoyalty] = useState<any>(null);
  const [referral, setReferral] = useState<any>(null);
  const [canPush] = useState(pushSupported);
  const [pushOn, setPushOn] = useState(false);
  const [locale, setLocaleState] = useState(getLocale());
  const chooseLocale = (l: 'ar' | 'en') => { setLocale(l); setLocaleState(l); };

  useEffect(() => {
    if (!user) return;
    customerApi.dashboard().then(setDash).catch(() => {});
    customerApi.loyalty().then(setLoyalty).catch(() => {});
    customerApi.referral().then(setReferral).catch(() => {});
    if (canPush) {
      navigator.serviceWorker?.getRegistration?.('/sw.js')
        .then(async (reg) => {
          const sub = await reg?.pushManager?.getSubscription();
          setPushOn(Boolean(sub));
        })
        .catch(() => setPushOn(false));
    }
  }, [user, canPush]);

  const togglePush = async () => {
    if (pushOn) {
      await disablePush();
      setPushOn(false);
    } else {
      const ok = await enablePush();
      setPushOn(ok);
    }
  };

  const tier = loyalty?.tier;
  const nextTier = loyalty?.next_tier;
  const tierProgress = loyalty && nextTier && loyalty.points_total < nextTier.min
    ? Math.min(100, Math.round(((loyalty.points_total - tier.min) / (nextTier.min - tier.min)) * 100))
    : 100;

  if (!user) {
    return (
      <div className="page">
        <div className="empty">
          <div className="empty__icon">👤</div>
          <div className="empty__title">{t('profile.guestTitle')}</div>
          <div className="empty__sub">{t('profile.guestSub')}</div>
          <button className="btn btn--primary" onClick={() => navigate('/login')} type="button">{t('profile.login')}</button>
          <Link to="/register" style={{ display: 'block', marginTop: 10, color: 'var(--brand)', fontWeight: 700, fontSize: 14 }}>
            {t('profile.createAccount')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      <header className="profile-hero">
        <div className="profile-hero__top">
          <div className="profile-hero__avatar">
            {user.avatar
              ? <img src={user.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : (user.name_ar || '؟').charAt(0)}
          </div>
          <div className="grow">
            <div className="profile-hero__name">{user.name_ar}</div>
            <div className="profile-hero__sub">{user.email}</div>
            {user.phone && <div className="profile-hero__sub">📞 {user.phone}</div>}
          </div>
          <button className="profile-hero__edit" onClick={() => navigate('/profile/edit')} type="button" aria-label={t('profile.editProfile')}>✏️</button>
        </div>
        <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          {tier && <span className="profile-hero__tier">{tier.icon} {t('profile.member', { name: tier.name })}</span>}
          {user.created_at && <span className="profile-hero__tier">🗓️ {t('profile.memberSince', { date: formatDate(user.created_at) })}</span>}
        </div>
      </header>

      <div className="profile-body">
        {dash && (
          <div className="stat-grid">
            <div className="card" style={{ background: 'var(--soft-red)', border: 'none' }}>
              <div className="stat-num">{formatCompact(dash.orders_value)}</div>
              <div className="stat-lbl">{t('profile.totalPurchases')}</div>
            </div>
            {[
              { k: 'pending_count', l: t('profile.statusPending') },
              { k: 'active_count', l: t('profile.statusActive') },
              { k: 'completed_count', l: t('profile.statusCompleted') },
            ].map((it) => (
              <div className="card" key={it.k}>
                <div className="stat-num">{dash[it.k] || 0}</div>
                <div className="stat-lbl">{it.l}</div>
              </div>
            ))}
          </div>
        )}

        <div className="reward-grid">
          {loyalty && (
            <button className="card reward-card--loyalty" onClick={() => navigate('/loyalty')} type="button" style={{ textAlign: 'right' }}>
              <div className="row row--between">
                <span className="reward-card__icon">{tier?.icon}</span>
                <span style={{ fontSize: 11, opacity: 0.8 }}>{tier?.name}</span>
              </div>
              <div className="reward-card__num">{loyalty.points_balance} ⭐</div>
              <div className="reward-card__lbl">
                {nextTier ? t('profile.loyaltyNext', { points: nextTier.min - loyalty.points_total }) : t('profile.loyaltyTop')}
              </div>
            </button>
          )}
          {referral && (
            <button className="card reward-card--referral" onClick={() => navigate('/referral')} type="button" style={{ textAlign: 'right' }}>
              <div className="row row--between">
                <span className="reward-card__icon">🎁</span>
                <span style={{ fontSize: 11, opacity: 0.8 }}>{t('profile.referralInvites', { count: referral.invited_count })}</span>
              </div>
              <div className="reward-card__num">+{formatCompact(referral.bonus_referrer)}</div>
              <div className="reward-card__lbl">{t('profile.referralPerFriend')}</div>
            </button>
          )}
        </div>

        <MenuGroup title={`🛍️ ${t('profile.groupActivity')}`}>
          <MenuRow icon="📦" label={t('profile.myOrders')} onClick={() => navigate('/orders')} />
          <MenuRow icon="⚖️" label={t('dispute.listTitle')} onClick={() => navigate('/disputes')} />
          <MenuRow icon="❤️" label={t('profile.favorites')} onClick={() => navigate('/favorites')} />
          <MenuRow icon="🔔" label={t('profile.notifications')} onClick={() => navigate('/notifications')} />
        </MenuGroup>

        <MenuGroup title={`🎁 ${t('profile.groupRewards')}`}>
          <MenuRow icon="⭐" label={t('profile.loyaltyPoints')} value={loyalty ? t('profile.points', { count: loyalty.points_balance }) : undefined} onClick={() => navigate('/loyalty')} />
          <MenuRow icon="🎁" label={t('profile.inviteFriends')} onClick={() => navigate('/referral')} />
          <MenuRow icon="🎟️" label={t('profile.coupons')} onClick={() => navigate('/coupons')} />
        </MenuGroup>

        <MenuGroup title={`⚙️ ${t('profile.groupSettings')}`}>
          <MenuRow icon="✏️" label={t('profile.editProfileInfo')} onClick={() => navigate('/profile/edit')} />
          <MenuRow icon="📍" label={t('profile.addresses')} onClick={() => navigate('/addresses')} />
          <div className="card" style={{ padding: 12, marginTop: 8 }}>
            <div className="menu-group__head">{t('notifprefs.title')}</div>
            <NotificationPreferencesForm api={api} />
          </div>
          {canPush && (
            <div className="menu-item">
              <span className="menu-item__icon">{pushOn ? '🔔' : '🔕'}</span>
              <span className="grow">{t('profile.pushNotifications')}</span>
              <button className={`switch${pushOn ? ' switch--on' : ''}`} onClick={togglePush} type="button" aria-label={t('profile.togglePushNotifications')} />
            </div>
          )}
          <div className="menu-item">
            <span className="menu-item__icon">{theme === 'dark' ? '🌙' : '☀️'}</span>
            <span className="grow">{t(theme === 'dark' ? 'profile.themeLight' : 'profile.themeDark')}</span>
            <button className={`switch${theme === 'dark' ? ' switch--on' : ''}`} onClick={toggle} type="button" aria-label={t('profile.toggleTheme')} />
          </div>
        </MenuGroup>

        <MenuGroup title={`ℹ️ ${t('profile.groupAbout')}`}>
          <MenuRow icon="📄" label={t('profile.privacyPolicy')} onClick={() => navigate('/privacy')} />
          <MenuRow icon="❓" label={t('profile.faq')} onClick={() => navigate('/faq')} />
        </MenuGroup>

        <MenuGroup title={`🌐 ${t('profile.groupLanguage')}`}>
          <button className="menu-item" onClick={() => chooseLocale('ar')} type="button">
            <span className="menu-item__icon">🇮🇶</span>
            <span className="grow">العربية</span>
            {locale === 'ar' && <span className="menu-item__value">✓</span>}
          </button>
          <button className="menu-item" onClick={() => chooseLocale('en')} type="button">
            <span className="menu-item__icon">🌐</span>
            <span className="grow">English</span>
            {locale === 'en' && <span className="menu-item__value">✓</span>}
          </button>
        </MenuGroup>

        <button className="menu-item menu-item--danger" style={{ borderRadius: 12, background: 'var(--danger-bg)', border: 'none' }} onClick={() => { logout(); navigate('/'); }} type="button">
          <span className="menu-item__icon">🚪</span>
          <span className="grow">{t('profile.logout')}</span>
          <span className="menu-item__chevron">‹</span>
        </button>
      </div>
    </div>
  );
}
