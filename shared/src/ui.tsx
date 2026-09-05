import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  memo,
  type ReactNode,
  type FormEvent,
  type ChangeEvent,
} from 'react';
import { t } from './i18n';
import { useLocale } from './LanguageSwitcher';

const APP_NAME_DEFAULT = 'سوق الرافدين';
let appNameCache: string | null = null;

export function useAppName(): string {
  const [name, setName] = useState<string>(appNameCache || APP_NAME_DEFAULT);
  useEffect(() => {
    let active = true;
    fetch('/api/public/config', { headers: { Accept: 'application/json' }, credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: any) => {
        const n = (d && d.data && d.data.app_name) || APP_NAME_DEFAULT;
        appNameCache = n;
        if (active) setName(n);
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);
  return name;
}

interface ToastItem {
  id: number;
  type: string;
  message: string;
}

interface ToastApi {
  success: (m: string) => void;
  error: (m: string) => void;
  info: (m: string) => void;
}

const noopToast: ToastApi = { success: () => {}, error: () => {}, info: () => {} };

const ToastContext = createContext<ToastApi>(noopToast);

let globalToastApi: ToastApi | null = null;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const push = useCallback((type: string, message: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, type, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

  const success = (m: string) => push('success', m);
  const error = (m: string) => push('error', m);
  const info = (m: string) => push('info', m);
  globalToastApi = { success, error, info };

  return (
    <ToastContext.Provider value={{ success, error, info }}>
      {children}
      <div className="toast-wrap" role="region" aria-live="polite" aria-label={t('notif.aria')}>
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`} role={t.type === 'error' ? 'alert' : 'status'}>{t.message}</div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  return useContext(ToastContext);
}

export const toast: ToastApi = {
  success: (m: string) => globalToastApi && globalToastApi.success(m),
  error: (m: string) => globalToastApi && globalToastApi.error(m),
  info: (m: string) => globalToastApi && globalToastApi.info(m),
};

export function useNotificationStream({ onEvent, enabled = true }: { onEvent?: () => void; enabled?: boolean }) {
  const ref = useRef<EventSource | null>(null);
  useEffect(() => {
    if (!enabled || typeof EventSource === 'undefined') return undefined;
    const es = new EventSource('/api/notifications/stream');
    const handler = () => onEvent && onEvent();
    es.addEventListener('notification', handler);
    ref.current = es;
    return () => {
      es.close();
      ref.current = null;
    };
  }, [enabled]);
  return ref;
}

export interface NotificationBellProps {
  api: { get: (p: string, e?: any) => Promise<any>; post: (p: string, b?: any, e?: any) => Promise<any> };
  onNavigate: (to: string) => void;
  pendingOrders?: number;
  onPendingClick?: () => void;
}

export function NotificationBell({ api, onNavigate, pendingOrders = 0, onPendingClick }: NotificationBellProps) {
  const locale = useLocale();
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<any[]>([]);
  const [show, setShow] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = () => {
    api.get('/notifications?limit=10', { silent: true })
      .then((r: any) => {
        setItems(r.data || []);
        setCount(Number(r.meta?.unread) || 0);
      })
      .catch(() => {});
  };

  useEffect(() => {
    refresh();
    // تسجيل SSE يجلب التحديثات لحظيًا (انظر useNotificationStream بالأسفل)؛ يبقى هذا الاستطلاع
    // الرجيع بنافذة أبطأ كخط أمان فقط عند انقطاع اتصال SSE (شبكات الهاتف غير المستقرة).
    timer.current = setInterval(refresh, 60000);
    return () => clearInterval(timer.current ?? undefined);
  }, []);

  useNotificationStream({ onEvent: refresh });

  const total = count + pendingOrders;

  const openItem = (n: { id: number | string; is_read?: boolean; url?: string }) => {
    if (!n.is_read) api.post(`/notifications/${n.id}/read`, {}, { silent: true }).catch(() => {});
    setShow(false);
    onNavigate(n.url || '/');
  };

  const readAll = () => {
    api.post('/notifications/read-all', {}, { silent: true }).then(refresh).catch(() => {});
  };

  return (
    <div className="bell-wrap">
      <button className={`bell ${show ? 'bell-open' : ''}`} onClick={() => setShow((s) => !s)} aria-label={t('panel.bell')}>
        🔔
        {total > 0 && <span className="bell-badge">{total > 99 ? '99+' : total}</span>}
      </button>
      {show && (
        <div className="bell-panel">
          {pendingOrders > 0 && (
            <div className="bell-item">
              <div className="bold">{pendingOrders > 1 ? t('panel.bell.pending.many', { count: pendingOrders }) : t('panel.bell.pending', { count: pendingOrders })}</div>
              <button className="btn btn-primary btn-sm" onClick={() => { setShow(false); onPendingClick && onPendingClick(); }}>{t('panel.bell.viewOrders')}</button>
            </div>
          )}
          <div className="bell-head">
            <span className="bold">{t('panel.bell')}</span>
            {count > 0 && <button className="btn btn-ghost btn-sm" onClick={readAll}>{t('panel.bell.readAll')}</button>}
          </div>
          {items.length === 0 ? (
            <div className="bell-empty">{t('panel.bell.empty')}</div>
          ) : (
            <div className="bell-list">
              {items.map((n) => (
                <button key={n.id} className={`bell-row${n.is_read ? '' : ' bell-row--unread'}`} onClick={() => openItem(n)}>
                  <span className="bell-row__icon">{n.icon || '🔔'}</span>
                  <span className="bell-row__body">
                    <span className="bell-row__title">{n.title}</span>
                    <span className="bell-row__text">{n.body}</span>
                    <span className="bell-row__time">{fmtDate(n.created_at)}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function fmt(n: number | string | null | undefined): string {
  if (n === null || n === undefined || isNaN(Number(n))) return '0';
  return Number(n).toLocaleString('en-US');
}

export function fmtDate(s: string | null | undefined): string {
  if (!s) return '-';
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleString('ar-IQ', { dateStyle: 'medium', timeStyle: 'short' });
}

interface StatusDef {
  label: string;
  cls: string;
}

export const ORDER_STATUS: Record<string, StatusDef> = {
  pending: { label: 'status.pending', cls: 'badge-amber' },
  confirmed: { label: 'status.confirmed', cls: 'badge-blue' },
  in_progress: { label: 'status.in_progress', cls: 'badge-teal' },
  completed: { label: 'status.completed', cls: 'badge-green' },
  cancelled: { label: 'status.cancelled', cls: 'badge-red' },
};

export const LEASE_STATUS: Record<string, StatusDef> = {
  active: { label: 'status.lease.active', cls: 'badge-green' },
  expired: { label: 'status.lease.expired', cls: 'badge-red' },
  pending: { label: 'status.lease.pending', cls: 'badge-amber' },
};

export const RECHARGE_STATUS: Record<string, StatusDef> = {
  pending: { label: 'status.recharge.pending', cls: 'badge-amber' },
  approved: { label: 'status.recharge.approved', cls: 'badge-green' },
  rejected: { label: 'status.recharge.rejected', cls: 'badge-red' },
};

export const WITHDRAWAL_STATUS: Record<string, StatusDef> = {
  pending: { label: 'status.withdrawal.pending', cls: 'badge-amber' },
  approved: { label: 'status.withdrawal.approved', cls: 'badge-green' },
  rejected: { label: 'status.withdrawal.rejected', cls: 'badge-red' },
};

export const VERIFY_STATUS: Record<string, StatusDef> = {
  none: { label: 'status.verify.none', cls: 'badge-gray' },
  pending: { label: 'status.verify.pending', cls: 'badge-amber' },
  approved: { label: 'status.verify.approved', cls: 'badge-green' },
  rejected: { label: 'status.verify.rejected', cls: 'badge-red' },
};

export const DISPUTE_STATUS: Record<string, StatusDef> = {
  open: { label: 'status.dispute.open', cls: 'badge-amber' },
  reviewing: { label: 'status.dispute.reviewing', cls: 'badge-blue' },
  resolved: { label: 'status.dispute.resolved', cls: 'badge-green' },
  rejected: { label: 'status.dispute.rejected', cls: 'badge-red' },
};

export const Badge = memo(function Badge({ status, map }: { status: string; map?: Record<string, StatusDef> }) {
  useLocale();
  const def = map ? map[status] : null;
  const cls = def ? def.cls : 'badge-gray';
  const label = def ? t(def.label) : status;
  return <span className={`badge ${cls}`}>{label}</span>;
});

export const Spinner = memo(function Spinner() {
  return <div className="spinner" />;
});

export const PageLoading = memo(function PageLoading() {
  return (
    <div className="page-loading">
      <Spinner />
    </div>
  );
});

export const EmptyState = memo(function EmptyState({ text, icon = '📭' }: { text?: string; icon?: string }) {
  useLocale();
  return (
    <div className="empty-state">
      <div className="big">{icon}</div>
      <div>{text ?? t('panel.empty')}</div>
    </div>
  );
});

export const Confirm = memo(function Confirm({
  open,
  title,
  message,
  confirmText,
  onConfirm,
  onCancel,
  danger = false,
}: {
  open: boolean;
  title?: string;
  message?: string;
  confirmText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  danger?: boolean;
}) {
  useLocale();
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onCancel} role="presentation">
      <div className="modal" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-message">
        <div className="modal-header">
          <h3 id="confirm-title">{title ?? t('panel.confirm.title')}</h3>
          <button className="modal-close" onClick={onCancel} aria-label={t('panel.close')}>×</button>
        </div>
        <div className="modal-body">
          <p id="confirm-message" style={{ lineHeight: 1.8 }}>{message}</p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onCancel}>{t('panel.cancel')}</button>
          <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm}>{confirmText ?? t('panel.confirm.ok')}</button>
        </div>
      </div>
    </div>
  );
});

export const Modal = memo(function Modal({
  open,
  title,
  onClose,
  children,
  size = undefined,
}: {
  open: boolean;
  title?: string;
  onClose?: () => void;
  children?: ReactNode;
  size?: 'lg' | 'md' | 'sm';
}) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div className={`modal ${size ?? ''}`} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-header">
          <h3 id="modal-title">{title}</h3>
          <button className="modal-close" onClick={onClose} aria-label={t('panel.close')}>×</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
});

export const Field = memo(function Field({
  label,
  required = false,
  hint = '',
  full = false,
  children,
  htmlFor,
}: {
  label: ReactNode;
  required?: boolean;
  hint?: string;
  full?: boolean;
  children?: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className={`field ${full ? 'full' : ''}`}>
      <label htmlFor={htmlFor}>{label}{required && <span className="req"> *</span>}</label>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </div>
  );
});

export const Toggle = memo(function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      style={{
        width: 42, height: 22, borderRadius: 20, border: 'none', cursor: 'pointer',
        background: checked ? 'var(--success)' : '#cbd5e1',
        position: 'relative', transition: 'background 0.15s',
      }}
    >
      <span
        style={{
          position: 'absolute', top: 2, width: 18, height: 18, borderRadius: '50%',
          background: '#fff', transition: 'all 0.15s',
          right: checked ? 22 : 2,
        }}
      />
    </button>
  );
});

export interface NotificationPrefs {
  in_app: boolean;
  push: boolean;
  categories: Record<string, boolean>;
}

// إدارة تفضيلات الإشعارات: القنوات (داخل التطبيق / Web Push) وفئات الإشعارات.
// تُستخدم في صفحة الملف الشخصي للوحات والزبون. أي تغيير يُحفظ فوراً عبر PUT.
export function NotificationPreferencesForm({ api }: { api: any }) {
  useLocale();
  const toast = useToast();
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [save, setSave] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api.get('/notifications/preferences');
      setPrefs(r.data || r);
    } catch (err: any) {
      toast.error(err.message);
    }
  }, [api, toast]);

  useEffect(() => { load(); }, [load]);

  const update = useCallback(async (next: NotificationPrefs) => {
    setPrefs(next);
    setSave(true);
    try {
      await api.put('/notifications/preferences', {
        in_app: next.in_app,
        push: next.push,
        categories: next.categories,
      });
      toast.success(t('notifprefs.saved'));
    } catch (err: any) {
      toast.error(err.message);
      load();
    } finally {
      setSave(false);
    }
  }, [api, toast, load]);

  if (!prefs) return <div className="page-loading"><span className="spinner" /></div>;

  const CATEGORY_KEYS = ['order', 'wallet', 'promotions', 'announcement', 'providers'];

  return (
    <div className="notif-prefs">
      <div className="pref-row">
        <div>
          <div className="pref-name">{t('notifprefs.inAppLabel')}</div>
          <div className="pref-hint">{t('notifprefs.inAppHint')}</div>
        </div>
        <Toggle checked={prefs.in_app} onChange={(v) => update({ ...prefs, in_app: v })} label={t('notifprefs.inAppLabel')} />
      </div>

      <div className="pref-row">
        <div>
          <div className="pref-name">{t('notifprefs.pushLabel')}</div>
          <div className="pref-hint">{t('notifprefs.pushHint')}</div>
        </div>
        <Toggle checked={prefs.push} onChange={(v) => update({ ...prefs, push: v })} label={t('notifprefs.pushLabel')} />
      </div>

      <div className="pref-divider" />

      <div className="pref-title">{t('notifprefs.categoriesTitle')}</div>
      {CATEGORY_KEYS.map((c) => (
        <div className="pref-row" key={c}>
          <div className="pref-name">{t(`notifprefs.cat_${c}`)}</div>
          <Toggle
            checked={!!prefs.categories[c]}
            onChange={(v) => update({ ...prefs, categories: { ...prefs.categories, [c]: v } })}
            label={t(`notifprefs.cat_${c}`)}
          />
        </div>
      ))}

      {save && <div className="pref-saving">{t('notifprefs.saving')}</div>}
    </div>
  );
}

type StatTone = 'primary' | 'accent' | 'success' | 'danger' | 'info' | 'warn' | 'muted';

export const StatCard = memo(function StatCard({ label, value, icon = undefined, tone = 'primary' }: { label: string; value: ReactNode; icon?: ReactNode; tone?: StatTone }) {
  const tones: Record<StatTone, { bg: string; color: string }> = {
    primary: { bg: 'var(--primary-light)', color: 'var(--primary-dark)' },
    accent: { bg: 'var(--accent-light)', color: '#92400e' },
    success: { bg: 'var(--success-light)', color: 'var(--success)' },
    danger: { bg: 'var(--danger-light)', color: 'var(--danger)' },
    info: { bg: 'var(--info-light)', color: 'var(--info)' },
    warn: { bg: '#fef3c7', color: '#92400e' },
    muted: { bg: 'var(--muted-bg, #f1f5f9)', color: 'var(--muted)' },
  };
  const t = tones[tone] || tones.primary;
  return (
    <div className="card stat-card flex-between">
      <div>
        <div className="stat-label">{label}</div>
        <div className="stat-value">{value}</div>
      </div>
      <div className="stat-icon" style={{ background: t.bg, color: t.color, width: 52, height: 52, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </div>
    </div>
  );
});

export const Pagination = memo(function Pagination({ meta, page, onChange }: { meta?: { total?: number; pages?: number } | null; page: number; onChange: (p: number) => void }) {
  useLocale();
  const total = meta?.total ?? 0;
  const pages = Math.max(1, meta?.pages || 1);
  if (!total) return null;
  const shown: number[] = [];
  const start = Math.max(1, Math.min(page, pages - 4));
  const end = Math.min(pages, start + 4);
  for (let i = start; i <= end; i += 1) shown.push(i);
  return (
    <nav className="pagination" aria-label={t('panel.pageInfo', { page, pages })}>
      <button type="button" className="page-btn" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label={t('common.prev')}>‹</button>
      {start > 1 && <span className="page-dots" aria-hidden="true">…</span>}
      {shown.map((n) => (
        <button key={n} type="button" className={`page-btn${n === page ? ' active' : ''}`} onClick={() => onChange(n)} aria-current={n === page ? 'page' : undefined}>{n}</button>
      ))}
      {end < pages && <span className="page-dots" aria-hidden="true">…</span>}
      <button type="button" className="page-btn" disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label={t('common.next')}>›</button>
      {pages > 1 && <span className="page-info" aria-live="polite">{t('panel.pageInfo', { page, pages })}</span>}
    </nav>
  );
});

export interface TwoFactorManagerProps {
  api: { post: (path: string, body?: unknown, extra?: any) => Promise<any> };
  enabled: boolean;
  onChanged?: (v: boolean) => void;
}

export function TwoFactorManager({ api, enabled, onChanged }: TwoFactorManagerProps) {
  const toastApi = useToast();
  const locale = useLocale();
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(enabled ? 'enabled' : 'off');
  const [secret, setSecret] = useState('');
  const [qr, setQr] = useState('');
  const [otpauth, setOtpauth] = useState('');
  const [code, setCode] = useState('');

  useEffect(() => {
    setStep(enabled ? 'enabled' : 'off');
  }, [enabled]);

  const startSetup = async () => {
    setBusy(true);
    try {
      const res = await api.post('/auth/2fa/setup');
      const d = res.data || res;
      setSecret(d.secret);
      setQr(d.qr_url);
      setOtpauth(d.otpauth_uri);
      setCode('');
      setStep('setup');
    } catch (e) {
      toastApi.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const enable = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/auth/2fa/enable', { code });
      toastApi.success(t('2fa.enabledDone'));
      if (onChanged) onChanged(true);
      setStep('enabled');
    } catch (err) {
      toastApi.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const disable = async (e: FormEvent) => {
    e.preventDefault();
    if (!code) { toastApi.error(t('2fa.needCode')); return; }
    setBusy(true);
    try {
      await api.post('/auth/2fa/disable', { code });
      toastApi.success(t('2fa.disabledDone'));
      if (onChanged) onChanged(false);
      setStep('off');
    } catch (err) {
      toastApi.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const input = (v: string) => (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="one-time-code"
      value={v}
      onChange={(e: ChangeEvent<HTMLInputElement>) => v === code ? setCode(e.target.value.replace(/\D/g, '').slice(0, 6)) : null}
      placeholder="••••••"
      style={{ maxWidth: 160 }}
      dir="ltr"
    />
  );

  if (step === 'setup') {
    return (
      <div>
        <p className="muted mb-3">{t('2fa.setupNote')}</p>
        {qr && <div className="mb-3" style={{ textAlign: 'center' }}><img src={qr} alt="QR" width={180} height={180} style={{ borderRadius: 8, border: '1px solid var(--border)' }} /></div>}
        <div className="mb-3">
          <div className="k" style={{ fontSize: 12 }}>{t('2fa.secretLabel')}</div>
          <code dir="ltr" style={{ fontSize: 13 }}>{secret}</code>
          <button
            type="button"
            className="btn btn-ghost"
            style={{ marginInlineStart: 8 }}
            onClick={() => { if (navigator.clipboard) navigator.clipboard.writeText(secret); toastApi.info(t('2fa.copied')); }}
          >{t('2fa.copy')}</button>
        </div>
        <form onSubmit={enable} className="flex gap-sm items-center">
          <Field label={t('2fa.code')} required>{input(code)}</Field>
          <button className="btn btn-primary" disabled={busy}>{busy ? t('2fa.enabling') : t('2fa.enable')}</button>
        </form>
        <button type="button" className="btn btn-ghost mt-2" onClick={() => setStep('off')} disabled={busy}>{t('panel.cancel')}</button>
      </div>
    );
  }

  if (step === 'enabled') {
    return (
      <div>
        <div className="flex items-center gap-sm mb-3">
          <span className="badge badge-green">✓ {t('2fa.enabled')}</span>
          <span className="muted" style={{ fontSize: 13 }}>{t('2fa.disableNote')}</span>
        </div>
        <form onSubmit={disable} className="flex gap-sm items-center">
          <Field label={t('2fa.currentCode')} required>{input(code)}</Field>
          <button className="btn btn-danger" disabled={busy}>{busy ? t('2fa.disabling') : t('2fa.disable')}</button>
        </form>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-sm mb-3">
        <span className="badge badge-gray">{t('2fa.disabled')}</span>
        <span className="muted" style={{ fontSize: 13 }}>{t('2fa.recommendNote')}</span>
      </div>
      <button className="btn btn-primary" onClick={startSetup} disabled={busy}>{busy ? t('2fa.settingUp') : t('2fa.enableBtn')}</button>
    </div>
  );
}

type SparklineData = { label: string; orders: number; revenue: number }[];

export function Sparkline({ data, metric, width = 160, height = 40, color = 'var(--primary)' }: { data: SparklineData; metric: 'orders' | 'revenue'; width?: number; height?: number; color?: string }) {
  if (!data?.length) return <div style={{ width, height, opacity: 0 }} />;
  const values = data.map((d) => d[metric]);
  const max = Math.max(...values, 1);
  const min = Math.min(...values);
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = height - ((v - min) / (max - min || 1)) * height;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="spark-gradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={points} />
      <polyline fill="url(#spark-gradient)" stroke="none" points={`0,${height} ${points} ${width},${height}`} />
      <circle cx={points.split(' ').slice(-1)[0].split(',')[0]} cy={points.split(' ').slice(-1)[0].split(',')[1]} r="3" fill={color} />
    </svg>
  );
}

export interface KPICardWithTrendProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  tone?: 'primary' | 'accent' | 'success' | 'danger' | 'info' | 'warn';
  deltaPct?: number;
  deltaLabel?: string;
  sparklineData?: SparklineData;
  sparklineMetric?: 'orders' | 'revenue';
}

export function KPICardWithTrend({ label, value, icon, tone = 'primary', deltaPct = 0, deltaLabel, sparklineData, sparklineMetric = 'orders' }: KPICardWithTrendProps) {
  const tones: Record<string, { bg: string; color: string }> = {
    primary: { bg: 'var(--primary-light)', color: 'var(--primary-dark)' },
    accent: { bg: 'var(--accent-light)', color: '#92400e' },
    success: { bg: 'var(--success-light)', color: 'var(--success)' },
    danger: { bg: 'var(--danger-light)', color: 'var(--danger)' },
    info: { bg: 'var(--info-light)', color: 'var(--info)' },
    warn: { bg: '#fef3c7', color: '#92400e' },
  };
  const t = tones[tone] || tones.primary;
  const isPositive = deltaPct > 0;
  const isNegative = deltaPct < 0;
  return (
    <div className="card stat-card flex-between">
      <div style={{ flex: 1 }}>
        <div className="stat-label">{label}</div>
        <div className="stat-value">{value}</div>
        {deltaPct !== undefined && (
          <div className="flex items-center gap-xs mt-1" style={{ fontSize: 13 }}>
            <span className={`badge ${isPositive ? 'badge-green' : isNegative ? 'badge-red' : 'badge-gray'}`}>
              {isPositive ? '↑' : isNegative ? '↓' : '→'} {Math.abs(deltaPct).toFixed(1)}%
            </span>
            {deltaLabel && <span className="muted">{deltaLabel}</span>}
          </div>
        )}
      </div>
      <div className="flex flex-col items-end" style={{ gap: 8 }}>
        <div className="stat-icon" style={{ background: t.bg, color: t.color, width: 52, height: 52, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {icon}
        </div>
        {sparklineData && (
          <div style={{ width: 140, height: 36, opacity: 0.8 }}>
            <Sparkline data={sparklineData} metric={sparklineMetric} width={140} height={36} color={t.color} />
          </div>
        )}
      </div>
    </div>
  );
}

export { Login } from './Login';
export { ChangePasswordForm } from './ChangePasswordForm';
export { PanelLayout } from './PanelLayout';
export { PageHead } from './PageHead';
export type { NavItem, PanelLayoutProps } from './PanelLayout';
export type { LoginProps } from './Login';
