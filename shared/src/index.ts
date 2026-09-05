// في التطوير فقط: ألغِ تسجيل أي Service Worker عالق من نسخة سابقة على نفس المنفذ (قد يطغى على
// تغيّرات Vite HMR ويعرقل إعادة تحميل اللوحة). في الإنتاج يجب بقاء الـSW مفعّلًا لدعم الإشعارات
// الفورية (Web Push) وقابلية تثبيت PWA.
const IS_DEV = typeof import.meta !== 'undefined' && !!import.meta.env && import.meta.env.DEV;
if (!IS_DEV && typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      for (const r of regs) r.unregister().catch(() => {});
    }).catch(() => {});
  });
}

export { ApiError, createApiClient, downloadFile } from './api';
export { createPush, pushSupported, urlBase64ToUint8Array } from './push';
export { createAuth } from './auth';
export { getLocale, setLocale, subscribeLocale, t, pickLocale, LOCALES } from './i18n';
export { LanguageSwitcher, useLocale } from './LanguageSwitcher';
export {
  ToastProvider,
  useToast,
  NotificationBell,
  fmt,
  fmtDate,
  ORDER_STATUS,
  LEASE_STATUS,
  Badge,
  Spinner,
  PageLoading,
  EmptyState,
  Confirm,
  Modal,
  Field,
  Toggle,
  StatCard,
  Pagination,
} from './ui';
export { useStaticLists } from './lists';
export { Login } from './ui';
export { ChangePasswordForm } from './ui';
export { PanelLayout } from './ui';
export { PageHead } from './ui';
export type { NavItem, PanelLayoutProps, LoginProps } from './ui';
