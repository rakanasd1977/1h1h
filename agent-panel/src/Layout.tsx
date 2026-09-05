import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from './auth';
import { PanelLayout } from '@rafidain/shared/ui';
import { api } from './api';
import { t } from '@rafidain/shared/i18n';
import { useLocale } from '@rafidain/shared';

type NavItem =
  | { section: string }
  | { to: string; label: string; icon: string; end?: boolean };

export default function Layout() {
  useLocale();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const govName = user?.governorate_name_ar || '-';
  const distName = user?.district_name_ar;
  const scopeTitle = distName ? t('ag.layout.roleDistrict', { name: distName }) : t('ag.layout.roleGov', { name: govName });
  const leaseExpired = user?.lease_status === 'expired';

  const NAV: NavItem[] = [
    { section: t('ag.layout.nav.home') },
    { to: '/', label: t('ag.layout.nav.dashboard'), icon: '📊', end: true },
    { section: t('ag.layout.nav.govMgmt') },
    { to: '/providers', label: t('ag.layout.nav.providers'), icon: '🏪' },
    { to: '/orders', label: t('ag.layout.nav.orders'), icon: '🧾' },
    { to: '/customers', label: t('ag.layout.nav.customers'), icon: '👥' },
    { to: '/activity', label: t('ag.layout.nav.activity'), icon: '📝' },
    { section: t('ag.layout.nav.accountComm') },
    { to: '/wallet', label: t('ag.layout.nav.wallet'), icon: '💰' },
    { to: '/commissions', label: t('ag.layout.nav.commissions'), icon: '📈' },
    { to: '/lease', label: t('ag.layout.nav.lease'), icon: '📜' },
    { to: '/profile', label: t('ag.layout.nav.profile'), icon: '👤' },
  ];

  const sidebarFooter = leaseExpired ? (
    <div style={{ background: 'var(--danger)', color: '#fff', borderRadius: 8, padding: 8 }}>
      {t('ag.layout.leaseExpired')}
    </div>
  ) : (
    <div>
      {distName ? (
        <>{t('ag.layout.yourDistrict', { name: distName })} <strong>{distName}</strong> <span className="muted">{t('ag.layout.districtGov', { name: govName })}</span></>
      ) : (
        <>{t('ag.layout.yourGov', { name: govName })} <strong>{govName}</strong></>
      )}
    </div>
  );

  return (
    <PanelLayout
      api={api}
      user={user}
      logout={logout}
      nav={NAV}
      logo="🤝"
      brandSubtitle={distName ? t('ag.layout.brandDistrict') : t('ag.layout.brandGov')}
      roleLabel={scopeTitle}
      headerTitle={distName ? t('ag.layout.headerDistrict', { name: distName }) : t('ag.layout.headerGov', { name: govName })}
      sidebarFooter={sidebarFooter}
      pathname={location.pathname}
      navigate={navigate}
    >
      <Outlet />
    </PanelLayout>
  );
}
