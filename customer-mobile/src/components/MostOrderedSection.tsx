import { useEffect, useState } from 'react';
import { AdsRow } from './AdsRow';
import { ProductCard } from './ProductCard';
import { SectionHead } from './SectionHead';
import { publicApi } from '../api';
import { useLocale, t } from '@rafidain/shared';
import { useGovernorate } from '../context/GovernorateContext';

export function MostOrderedSection({ limit = 10, mostOrderedAds }: { limit?: number; mostOrderedAds?: any[] }) {
  useLocale();
  const { governorate } = useGovernorate();
  const [items, setItems] = useState<any>(null);
  const code = (governorate && governorate.code) || '';

  useEffect(() => {
    let alive = true;
    setItems(null);
    publicApi
      .topSelling(code, limit)
      .then((r) => alive && setItems(Array.isArray(r) ? r : []))
      .catch(() => alive && setItems([]));
    return () => {
      alive = false;
    };
  }, [code, limit]);

  return (
    <section className="home-block">
      <SectionHead icon="🔥" title={t('mostOrdered.title')} moreTo="/search?sort=sold" />
      <AdsRow placement="most_ordered" title={t('mostOrdered.adsTitle')} limit={6} initialAds={mostOrderedAds} />
      {items && items.length > 0 && (
        <div className="hscroll">
          {items.map((it: any) => (
            <ProductCard
              key={`${it.kind}-${it.id}`}
              item={it}
              to={`/item/${it.provider_id}/${it.kind}/${it.id}`}
              unit={it.unit}
            />
          ))}
        </div>
      )}
    </section>
  );
}
