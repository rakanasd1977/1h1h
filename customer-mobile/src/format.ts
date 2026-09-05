import { getLocale } from '@rafidain/shared';

export function formatPrice(n: number | string): string {
  const v = Number(n) || 0;
  return v.toLocaleString('en-US') + ' د.ع';
}

export function formatCompact(n: number | string): string {
  const v = Number(n) || 0;
  const isAr = getLocale() === 'ar';
  if (v >= 1000000) {
    const m = (v / 1000000).toFixed(1);
    return isAr ? m.replace('.', ',') + ' م' : m + 'M';
  }
  if (v >= 1000) {
    return isAr ? Math.round(v / 1000).toLocaleString('en-US') + ' ألف' : Math.round(v / 1000) + 'K';
  }
  return String(v);
}

export function discountPercent(oldPrice: number | string, price: number | string): number {
  const o = Number(oldPrice);
  const p = Number(price);
  if (!(o > 0) || !(o > p)) return 0;
  return Math.round(((o - p) / o) * 100);
}

function dateLocale(): string {
  return getLocale() === 'en' ? 'en-GB' : 'ar-IQ';
}

export function formatDate(s: string): string {
  if (!s) return '';
  const d = new Date(s.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString(dateLocale(), { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDateTime(s: string): string {
  if (!s) return '';
  const d = new Date(s.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return s;
  return (
    d.toLocaleDateString(dateLocale(), { year: 'numeric', month: 'short', day: 'numeric' }) +
    ' ' +
    d.toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' })
  );
}

export function timeAgo(s: string): string {
  if (!s) return '';
  const d = new Date(s.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return '';
  const diff = Math.max(0, Date.now() - d.getTime());
  const min = Math.floor(diff / 60000);
  const isAr = getLocale() === 'ar';
  if (min < 1) return isAr ? 'الآن' : 'now';
  if (min < 60) return isAr ? `منذ ${min} د` : `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return isAr ? `منذ ${hr} س` : `${hr} hr ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return isAr ? `منذ ${day} يوم` : `${day} day${day === 1 ? '' : 's'} ago`;
  return formatDate(s);
}