import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter, useLocation } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { GovernorateProvider } from './context/GovernorateContext';
import { CartProvider } from './context/CartContext';
import { FavoritesProvider } from './context/FavoritesContext';
import { FollowProvider } from './context/FollowContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from '@rafidain/shared/ui';
import './styles.css';

// سجّل الـService Worker مبكرًا (بلا اشتراك Push) لدعم تثبيت PWA وعرض آفلين،
// قبل تسجيل الدخول. الاشتراك الفعلي في Web Push يحدث عند الدخول عبر enablePush.
// في بيئة التطوير (DEV) نُزيل أي SW قديم مع كاشاته لمنع تقديم محتوى عالق وصفحات بيضاء.
function registerServiceWorker() {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      if (import.meta.env.DEV) {
        navigator.serviceWorker.getRegistrations().then((regs) =>
          Promise.all(regs.map((r) => r.unregister()))
        ).then(() => caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))).catch(() => {});
      } else {
        navigator.serviceWorker.register('/sw.js').catch(() => {});
      }
    });
  }
}
registerServiceWorker();

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <ScrollToTop />
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <GovernorateProvider>
              <CartProvider>
                <FavoritesProvider>
                  <FollowProvider>
                    <App />
                  </FollowProvider>
                </FavoritesProvider>
              </CartProvider>
            </GovernorateProvider>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </HashRouter>
  </React.StrictMode>
);
