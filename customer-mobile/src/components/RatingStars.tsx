import { useLocale, t } from '@rafidain/shared';

export function RatingStars({ rating, count = 0 }: { rating: number | string; count?: number }) {
  useLocale();
  const r = Number(rating) || 0;
  return (
    <span className="row" style={{ gap: 4 }}>
      <span className="stars">{'★'.repeat(Math.round(r))}{'☆'.repeat(5 - Math.round(r))}</span>
      <span className="rating-num">{r ? r.toFixed(1) : t('rating.new')}</span>
      {count ? <span className="muted">({count})</span> : null}
    </span>
  );
}
