import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useTheme } from '../context/ThemeContext';
import { useGovernorate } from '../context/GovernorateContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { useAppName } from '@rafidain/shared/ui';
import { useLocale, t } from '@rafidain/shared';
import { IconSearch, IconBell, IconCart, IconSun, IconMoon, IconPin, IconChevronDown } from '../icons';

export function TopBar({ title = '', search }: { title?: string; search?: { value: string; onChange: (v: string) => void; onSubmit?: () => void; placeholder?: string } }) {
  const navigate = useNavigate();
  useLocale();
  const { totalCount } = useCart();
  const { theme, toggle } = useTheme();
  const { governorate, openPicker } = useGovernorate();
  const { user } = useAuth();
  const appName = useAppName();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user) return;
    const check = () => {
      api.get('/notifications/unread-count', { silent: true }).then((d) => setUnread(d?.unread || 0)).catch(() => {});
    };
    check();
    const t = setInterval(check, 30000);
    return () => clearInterval(t);
  }, [user]);

  const icons = (
    <>
      <button className="iconbtn iconbtn--light" onClick={() => navigate('/notifications')} type="button" aria-label={t('common.notifications')}>
        <IconBell />
        {unread > 0 && <span className="badge">{unread}</span>}
      </button>
      <button className="iconbtn iconbtn--light" onClick={() => navigate('/cart')} type="button" aria-label={t('common.cart')}>
        <IconCart />
        {totalCount > 0 && <span className="badge">{totalCount}</span>}
      </button>
      <button className="iconbtn iconbtn--light" onClick={toggle} type="button" aria-label={theme === 'dark' ? t('common.lightMode') : t('common.darkMode')}>
        {theme === 'dark' ? <IconSun /> : <IconMoon />}
      </button>
    </>
  );

  if (search) {
    return (
      <header className="topbar topbar--search">
        <div className="topbar__row">
          <button className="gov-pill gov-pill--mini" type="button" onClick={openPicker} aria-label={t('common.changeGovernorate')}>
            <IconPin />
            <span className="gov-pill__name">{governorate ? (governorate.name || governorate.name_ar) : ''}</span>
            <IconChevronDown />
          </button>
          <span className="topbar__brand">{appName}</span>
          <div className="topbar__icons">{icons}</div>
        </div>
        <div className="searchbox topbar__search">
          <span className="searchbox__icon"><IconSearch /></span>
          <input
            value={search.value}
            onChange={(e) => search.onChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && search.onSubmit?.()}
            placeholder={search.placeholder || t('common.searchPlaceholder')}
            aria-label={t('common.search')}
          />
        </div>
      </header>
    );
  }

  return (
    <header className="topbar topbar--flat">
      {title ? <span className="topbar__title">{title}</span> : null}
      <button className="iconbtn iconbtn--light topbar__search-btn" onClick={() => navigate('/search')} type="button" aria-label={t('common.search')}>
        <IconSearch />
      </button>
      {icons}
    </header>
  );
}
