import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import '@rafidain/shared/styles.css';

// سجّل الـService Worker مبكرًا لدعم تثبيت PWA وعرض آفلين وتمكين Web Push.
// في بيئة التطوير (DEV) نُزيل أي SW قديم مع كاشاته لمنع تقديم محتوى عالق وصفحات بيضاء.
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

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
