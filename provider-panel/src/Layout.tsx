import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from './auth';
import { PanelLayout } from '@rafidain/shared/ui';
import { api } from './api';
import { CATALOGS } from './catalog';
import { t } from '@rafidain/shared/i18n';
import { useLocale } from '@rafidain/shared';

function buildNav(serviceType: string) {
  const cat = (CATALOGS as Record<string, any>)[serviceType];
  const items: any[] = [
    { section: t('pr.layout.section.index') },
    { to: '/', label: t('pr.layout.nav.dashboard'), icon: '📊', end: true },
    { section: t('pr.layout.section.promo') },
  ];
  if (cat) items.push({ to: '/catalog', label: t(cat.title), icon: cat.icon });
  if (['stores', 'restaurants'].includes(serviceType)) {
    items.push({ to: '/categories', label: serviceType === 'stores' ? t('pr.layout.nav.categories.stores') : t('pr.layout.nav.categories.restaurants'), icon: '🗂️' });
  }
  items.push({ to: '/offers', label: t('pr.layout.nav.offers'), icon: '🏷️' });
  items.push({ section: t('pr.layout.section.promo') });
  items.push({ to: '/promotions', label: t('pr.layout.nav.promotions'), icon: '📢' });
  items.push({ to: '/coupons', label: t('pr.layout.nav.coupons'), icon: '🎟️' });
  items.push({ section: t('pr.layout.section.orders') });
  items.push({ to: '/orders', label: t('pr.layout.nav.orders'), icon: '🧾' });
  if (['hotels', 'flights', 'travel_offices'].includes(serviceType)) {
    items.push({ to: '/bookings', label: t('pr.layout.nav.bookings'), icon: '📅' });
  }
  items.push({ section: t('pr.layout.section.account') });
  items.push({ to: '/wallet', label: t('pr.layout.nav.wallet'), icon: '👛' });
  items.push({ to: '/ratings', label: t('pr.layout.nav.ratings'), icon: '⭐' });
  items.push({ to: '/profile', label: t('pr.layout.nav.profile'), icon: '👤' });
  return items;
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [pending, setPending] = useState(0);
  useLocale();

  useEffect(() => {
    const check = () => {
      api.get('/provider/orders-summary', { silent: true })
        .then((r: any) => setPending(Number(r.data?.pending) || 0))
        .catch(() => {});
    };
    check();
    const timer = setInterval(check, 30000);
    return () => clearInterval(timer);
  }, []);

  const serviceType = user?.service_type;
  const cat = (CATALOGS as Record<string, any>)[serviceType];
  const serviceName = t(cat?.title || user?.service_type || 'pr.layout.brandSubtitle');
  const NAV = buildNav(serviceType);

  return (
    <PanelLayout
      api={api}
      user={user}
      logout={logout}
      nav={NAV}
      logo="🏪"
      brandSubtitle={t('pr.layout.brandSubtitle')}
      roleLabel={serviceName}
      headerTitle={`${cat?.icon} ${serviceName} — ${user?.provider_name || ''}`}
      notificationProps={{ pendingOrders: pending, onPendingClick: () => navigate('/orders?status=pending') }}
      pathname={location.pathname}
      navigate={navigate}
    >
      <Outlet />
    </PanelLayout>
  );
}
