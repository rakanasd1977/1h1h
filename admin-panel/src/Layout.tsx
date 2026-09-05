import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth, useAuthPermissions } from './auth';
import { useToast, fmt, useAppName, PanelLayout, type NavItem } from '@rafidain/shared/ui';
import { api } from './api';
import { t } from '@rafidain/shared/i18n';
import { useLocale } from '@rafidain/shared';

const POLL_MS = 20000;

function playBeep() {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new Ctx();
    const tone = (freq: any, at: any, dur: any) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.type = 'sine';
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + at);
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + at + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + dur);
      o.start(ctx.currentTime + at);
      o.stop(ctx.currentTime + at + dur + 0.05);
    };
    tone(880, 0, 0.22);
    tone(1175, 0.26, 0.3);
    setTimeout(() => { try { ctx.close(); } catch (e: any) { /* تجاهل */ } }, 1300);
  } catch (e: any) { /* لا صوت مدعوم */ }
}

export default function Layout() {
  useLocale();
  const { user, logout } = useAuth();
  const { can } = useAuthPermissions();
  const toast = useToast();
  const appName = useAppName();
  const navigate = useNavigate();
  const location = useLocation();

  const NAV: NavItem[] = [
    { section: t('ad.layout.nav.home') },
    { to: '/', label: t('ad.layout.nav.dashboard'), icon: '📊', end: true, perm: ['dashboard', 'view'] },
    { to: '/executive', label: t('ad.layout.nav.executive'), icon: '🎯', perm: ['dashboard', 'view'] },
    { section: t('ad.layout.nav.generalMgmt') },
    { to: '/governorates', label: t('ad.layout.nav.governorates'), icon: '🏙️', perm: ['governorates', 'view'] },
    { to: '/districts', label: t('ad.layout.nav.districts'), icon: '🗺️', perm: ['districts', 'view'] },
    { to: '/agents', label: t('ad.layout.nav.agents'), icon: '🤝', perm: ['agents', 'view'] },
    { to: '/providers', label: t('ad.layout.nav.providers'), icon: '🏪', perm: ['providers', 'view'] },
    { to: '/services', label: t('ad.layout.nav.services'), icon: '🧩', perm: ['services', 'view'] },
    { section: t('ad.layout.nav.storeContent') },
    { to: '/catalog', label: t('ad.layout.nav.catalog'), icon: '🛍️', perm: ['catalog', 'view'] },
    { to: '/coupons', label: t('ad.layout.nav.coupons'), icon: '🎟️', perm: ['coupons', 'view'] },
    { to: '/reviews', label: t('ad.layout.nav.reviews'), icon: '⭐', perm: ['reviews', 'view'] },
    { to: '/notifications', label: t('ad.layout.nav.notifications'), icon: '📣', perm: ['notifications', 'view'] },
    { to: '/home-layout', label: t('ad.layout.nav.homeLayout'), icon: '🧱', perm: ['home_layout', 'view'] },
    { to: '/content', label: t('ad.layout.nav.content'), icon: '📄', perm: ['settings', 'view'] },
    { section: t('ad.layout.nav.permissions') },
    { to: '/roles', label: t('ad.layout.nav.roles'), icon: '🔐', perm: ['roles', 'view'] },
    { to: '/admin-users', label: t('ad.layout.nav.adminUsers'), icon: '👥', perm: ['users', 'view'] },
    { section: t('ad.layout.nav.data') },
    { to: '/bulk', label: t('ad.layout.nav.bulk'), icon: '📦', perm: ['bulk', 'view'] },
    { section: t('ad.layout.nav.operations') },
    { to: '/orders', label: t('ad.layout.nav.orders'), icon: '🧾', perm: ['orders', 'view'] },
    { to: '/customers', label: t('ad.layout.nav.customers'), icon: '👥', perm: ['customers', 'view'] },
    { to: '/commissions', label: t('ad.layout.nav.commissions'), icon: '💰', perm: ['commissions', 'view'] },
    { to: '/financial-report', label: t('ad.layout.nav.financialReport'), icon: '📈', perm: ['financial_reports', 'view'] },
    { to: '/promotions', label: t('ad.layout.nav.promotions'), icon: '📢', perm: ['promotions', 'view'] },
    { to: '/wallets', label: t('ad.layout.nav.wallets'), icon: '👛', perm: ['wallets', 'view'] },
    { to: '/agent-withdrawals', label: t('ad.layout.nav.agentWithdrawals'), icon: '💸', perm: ['withdrawals', 'view'] },
    { to: '/disputes', label: t('ad.layout.nav.disputes'), icon: '⚖️', perm: ['disputes', 'view'] },
    { to: '/payment-gateways', label: t('ad.layout.nav.paymentGateways'), icon: '💳', perm: ['payment_gateways', 'view'] },
    { to: '/leases', label: t('ad.layout.nav.leases'), icon: '📜', perm: ['leases', 'view'] },
    { section: t('ad.layout.nav.system') },
    { to: '/activity', label: t('ad.layout.nav.activity'), icon: '📋', perm: ['activity_log', 'view'] },
    { to: '/settings', label: t('ad.layout.nav.settings'), icon: '⚙️', perm: ['settings', 'view'] },
    { to: '/profile', label: t('ad.layout.nav.profile'), icon: '👤' },
  ];
  const [pendingRecharges, setPendingRecharges] = useState(0);
  const prevCount = useRef(null);
  const appNameRef = useRef(appName);
  appNameRef.current = appName;

  useEffect(() => {
    const check = () => {
      api.get('/recharges?status=pending', { silent: true })
        .then((r) => {
          const count = (r.data || []).length;
          setPendingRecharges(count);
          document.title = count > 0 ? t('ad.layout.rechargeTitle', { count, app: appNameRef.current }) : appNameRef.current;
          if (prevCount.current !== null && count > prevCount.current) {
            playBeep();
            const newest = r.data[0];
            const txt = `🔔 ${newest.reference} — ${newest.provider_name}: ${fmt(newest.amount)} ${t('ad.currency')}`;
            toast.success(t('ad.layout.newRechargeToast', { txt }));
            if ('Notification' in window && Notification.permission === 'granted') {
              try { new Notification(t('ad.layout.newRechargeNotif', { app: appNameRef.current }), { body: txt, icon: '🛒' }); } catch (e: any) { /* تجاهل */ }
            }
          }
          prevCount.current = count;
        })
        .catch(() => {});
    };
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
    check();
    const timer = setInterval(check, POLL_MS);
    return () => clearInterval(timer);
  }, [toast]);

  return (
    <PanelLayout
      api={api}
      user={user}
      logout={logout}
      nav={NAV}
      logo="🛒"
      brandSubtitle={t('ad.layout.brandSubtitle')}
      roleLabel={t('ad.layout.roleLabel')}
      can={can}
      navBadge={(item) => (item.to === '/wallets' ? pendingRecharges : undefined)}
      headerTitle={t('ad.layout.headerTitle')}
      pathname={location.pathname}
      navigate={navigate}
    >
      <Outlet />
    </PanelLayout>
  );
}
