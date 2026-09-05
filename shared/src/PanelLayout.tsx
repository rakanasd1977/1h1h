import { useState, useEffect, type ReactNode } from 'react';
import { useToast, useAppName, NotificationBell } from './ui';
import { t } from './i18n';
import { useLocale } from './LanguageSwitcher';

export interface NavItem {
  section?: string;
  to?: string;
  label?: string;
  icon?: string;
  end?: boolean;
  perm?: [string, string];
}

export interface PanelLayoutProps {
  api: any;
  user: any;
  logout: () => void;
  nav: NavItem[];
  logo: string;
  brandSubtitle: string;
  roleLabel?: string;
  can?: (resource: string, action: string) => boolean;
  sidebarFooter?: ReactNode;
  headerTitle?: ReactNode;
  notificationProps?: { pendingOrders?: number; onPendingClick?: () => void };
  navBadge?: (item: NavItem) => number | boolean | undefined;
  pathname: string;
  navigate: (to: string) => void;
  children: ReactNode;
}

function navMatch(item: NavItem, pathname: string) {
  if (!item.to) return false;
  if (item.end) return pathname === item.to;
  return pathname === item.to || pathname.startsWith(item.to + '/');
}

export function PanelLayout(props: PanelLayoutProps) {
  const { api, user, logout, nav, logo, brandSubtitle, roleLabel, can, sidebarFooter, headerTitle, notificationProps, navBadge, pathname, navigate, children } = props;
  const toast = useToast();
  const appName = useAppName();
  const locale = useLocale();
  const [open, setOpen] = useState(false);

  useEffect(() => { document.title = appName; }, [appName]);

  const canView = (item: NavItem) => !item.perm || !can || can(item.perm[0], item.perm[1]);

  const navItems = nav
    .map((item, i) => {
      if (item.section) {
        let visible = false;
        for (let j = i + 1; j < nav.length; j++) {
          if (nav[j].section) break;
          if (canView(nav[j])) {
            visible = true;
            break;
          }
        }
        return { ...item, _visible: visible };
      }
      return { ...item, _visible: canView(item) };
    })
    .filter((x) => (x as any)._visible);

  const current = nav.find((item) => item.to && navMatch(item, pathname));
  const denied = current && current.perm && can && !can(current.perm[0], current.perm[1]);

  const handleLogout = () => {
    logout();
    toast.success(t('panel.logoutDone'));
    navigate('/login');
  };

  const initial = (user?.name_ar || 'م').trim().charAt(0);

  return (
    <div className="app">
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand">
          <div className="logo">{logo}</div>
          <div>
            <div className="title">{appName}</div>
            <div className="sub">{brandSubtitle}</div>
          </div>
        </div>
        <nav>
          {navItems.map((item, i) =>
            item.section ? (
              <div className="section-label" key={i}>{item.section}</div>
            ) : (
              (() => {
                const active = item.to && navMatch(item, pathname);
                return (
                  <a
                    key={i}
                    href={item.to}
                    className={active ? 'active' : ''}
                    onClick={(e) => {
                      e.preventDefault();
                      setOpen(false);
                      navigate(item.to as string);
                    }}
                  >
                    <span className="icon">{item.icon}</span>
                    {item.label}
                    {navBadge && navBadge(item) ? <span className="nav-badge">{navBadge(item)}</span> : null}
                  </a>
                );
              })()
            )
          )}
        </nav>
        {sidebarFooter && <div className="sidebar-footer">{sidebarFooter}</div>}
      </aside>

      <div className={`sidebar-overlay${open ? ' show' : ''}`} onClick={() => setOpen(false)} />

      <div className="main">
        <header className="topbar">
          <button className="menu-toggle" onClick={() => setOpen((o) => !o)} type="button" aria-label={t('panel.menu')}>☰</button>
          <div className="page-title">{headerTitle || brandSubtitle}</div>
          <div className="topbar-actions">
            <NotificationBell api={api} onNavigate={(to) => navigate(to)} {...notificationProps} />
            <div className="user-chip">
              <div className="avatar">{initial}</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{user?.name_ar}</div>
                <div className="muted" style={{ fontSize: 11 }}>{roleLabel || ''}</div>
              </div>
            </div>
            <button className="btn btn-outline btn-sm" onClick={handleLogout}>{t('panel.logout')}</button>
          </div>
        </header>
        <main className="content">
          {denied ? (
            <div className="card">
              <div className="card-body" style={{ textAlign: 'center', padding: 40 }}>
                <div style={{ fontSize: 40 }}>🚫</div>
                <h3>{t('panel.denied.title')}</h3>
                <p className="muted">{t('panel.denied.body')}</p>
              </div>
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}
