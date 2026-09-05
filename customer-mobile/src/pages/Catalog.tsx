import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { ProductCard } from '../components/ProductCard';
import { AdsRow } from '../components/AdsRow';
import { EmptyState } from '../components/EmptyState';
import { CenterSpinner } from '../components/Spinner';
import { publicApi } from '../api';
import { useLocale, t } from '@rafidain/shared';

const SORTS = [
  { v: '', k: 'catalog.sortNewest' },
  { v: 'price_asc', k: 'catalog.sortPriceAsc' },
  { v: 'price_desc', k: 'catalog.sortPriceDesc' },
  { v: 'rating', k: 'catalog.sortRating' },
  { v: 'sold', k: 'catalog.sortSold' },
];

export default function Catalog() {
  const { id } = useParams();
  useLocale();
  const [categories, setCategories] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [cat, setCat] = useState('');
  const [sort, setSort] = useState('');
  const [offersOnly, setOffersOnly] = useState(false);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const pageRef = useRef(1);

  useEffect(() => {
    publicApi.categories(id || '').then((rows) => setCategories(rows || [])).catch(() => {});
  }, [id]);

  const fetchPage = (pg: number, append: boolean) => {
    return publicApi
      .products(id || '', { category_id: cat, page: pg, sort, offers: offersOnly ? '1' : undefined, min_price: minPrice || undefined, max_price: maxPrice || undefined }, true)
      .then((res) => {
        const rows = (res && res.data) || [];
        const meta = res && res.meta;
        if (append) {
          setProducts((prev) => [...prev, ...rows]);
        } else {
          setProducts(rows);
        }
        pageRef.current = pg;
        setTotal(meta ? meta.total : 0);
        setHasMore(Boolean(meta && meta.page * meta.limit < meta.total));
        return rows;
      });
  };

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setHasMore(false);
    fetchPage(1, false)
      .then(() => alive && undefined)
      .catch(() => alive && setProducts([]))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [id, cat, sort, offersOnly, minPrice, maxPrice]);

  const loadMore = () => {
    if (loadingMore) return;
    setLoadingMore(true);
    fetchPage(pageRef.current + 1, true)
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  };

  return (
    <div>
      <PageHeader title={t('catalog.products')} />
      <div className="page page--no-nav">
        <AdsRow />
        {categories.length > 0 && (
          <div className="chips">
            <button className={`chip${!cat ? ' chip--active' : ''}`} onClick={() => setCat('')} type="button">{t('catalog.all')}</button>
            {categories.map((c) => (
              <button key={c.id} className={`chip${String(cat) === String(c.id) ? ' chip--active' : ''}`} onClick={() => setCat(c.id)} type="button">
                {c.name}
              </button>
            ))}
          </div>
        )}

        <div className="row" style={{ gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          <button
            className={`chip${offersOnly ? ' chip--active' : ''}`}
            style={{ margin: 0, height: 32 }}
            onClick={() => setOffersOnly((v) => !v)}
            type="button"
          >
            🔥 {t('catalog.discounts')}
          </button>
          <input
            className="input catalog-price"
            type="number"
            inputMode="numeric"
            min="0"
            placeholder={t('catalog.priceFrom')}
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
          />
          <input
            className="input catalog-price"
            type="number"
            inputMode="numeric"
            min="0"
            placeholder={t('catalog.priceTo')}
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
          />
        </div>

        <div className="row row--between" style={{ marginBottom: 8 }}>
          <span className="muted">{total > 0 ? t('catalog.count', { count: total }) : t('catalog.products')}</span>
          <div className="seg" style={{ padding: 0 }}>
            {SORTS.map((s) => (
              <button
                key={s.v}
                type="button"
                className={`seg__btn${sort === s.v ? ' seg__btn--active' : ''}`}
                onClick={() => setSort(s.v)}
              >
                {t(s.k)}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <CenterSpinner />
        ) : products.length ? (
          <>
            <div className="grid-2">
              {products.map((pr) => (
                <ProductCard
                  key={pr.id}
                  item={pr}
                  icon="🛍️"
                  to={`/item/${id}/products/${pr.id}`}
                  unit={t('catalog.unit')}
                />
              ))}
            </div>
            {hasMore && (
              <button className="btn btn--outline btn--block" onClick={loadMore} disabled={loadingMore} type="button" style={{ marginTop: 6 }}>
                {loadingMore ? t('catalog.loadingMore') : t('catalog.showMore')}
              </button>
            )}
          </>
        ) : (
          <EmptyState icon="🛍️" title={t('catalog.emptyTitle')} sub={t('catalog.emptySub')} />
        )}
      </div>
    </div>
  );
}
