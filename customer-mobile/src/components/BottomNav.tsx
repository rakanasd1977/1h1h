import { useNavigate, useLocation } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { NAV_HEIGHT } from '../theme';
import { IconHome, IconHeart, IconCart, IconBox, IconUser } from '../icons';
import { useLocale, t } from '@rafidain/shared';

const TABS = [
  { to: '/', icon: <IconHome />, key: 'nav.home' },
  { to: '/favorites', icon: <IconHeart />, key: 'nav.favorites' },
  { to: '/cart', icon: <IconCart />, key: 'nav.cart' },
  { to: '/orders', icon: <IconBox />, key: 'nav.orders' },
  { to: '/profile', icon: <IconUser />, key: 'nav.account' },
];

export function BottomNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { totalCount } = useCart();
  useLocale();

  const active = (to: string) => (pathname === to || (to !== '/' && pathname.startsWith(to))) || (to === '/' && pathname === '/');

  return (
    <nav className="bottomnav" style={{ height: NAV_HEIGHT }}>
      {TABS.map((tab) => {
        const isActive = active(tab.to);
        return (
          <button
            key={tab.to}
            className={`bottomnav__item${isActive ? ' bottomnav__item--active' : ''}`}
            onClick={() => navigate(tab.to)}
            type="button"
          >
            <span className="bottomnav__icon">
              {tab.icon}
              {tab.to === '/cart' && totalCount > 0 && <span className="badge" style={{ left: 'auto', right: -8, top: -4 }}>{totalCount}</span>}
            </span>
            <span>{t(tab.key)}</span>
          </button>
        );
      })}
    </nav>
  );
}
