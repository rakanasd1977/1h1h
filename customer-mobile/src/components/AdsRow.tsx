import { useEffect, useState } from 'react';
import { AdCarousel } from './AdCarousel';
import { publicApi } from '../api';
import { useGovernorate } from '../context/GovernorateContext';
import { useLocale, t } from '@rafidain/shared';

export function AdsRow({ govCode = '', limit = 8, title, placement = 'home_top', variant, className, initialAds }: { govCode?: string; limit?: number; title?: string; placement?: string; variant?: string; className?: string; initialAds?: any[] }) {
  useLocale();
  const { governorate } = useGovernorate();
  const [ads, setAds] = useState<any>(initialAds !== undefined ? initialAds : null);

  const code = govCode || (governorate && governorate.code) || '';

  useEffect(() => {
    if (initialAds !== undefined) {
      setAds(initialAds.slice(0, limit));
      return;
    }
    let alive = true;
    setAds(null);
    publicApi
      .promotions(code, placement)
      .then((rows) => alive && setAds((rows || []).slice(0, limit)))
      .catch(() => alive && setAds([]));
    return () => {
      alive = false;
    };
  }, [code, limit, placement, initialAds]);

  if (!ads || ads.length === 0) return null;

  const rowTitle = title ?? t('ads.title');

  return (
    <div className={className || undefined}>
      {rowTitle ? <div className="section-title">{rowTitle}</div> : null}
      <AdCarousel ads={ads} variant={variant} />
    </div>
  );
}
