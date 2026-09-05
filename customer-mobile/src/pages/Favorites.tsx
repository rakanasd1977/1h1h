import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useFavorites } from '../context/FavoritesContext';
import { customerApi } from '../api';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { Spinner } from '../components/Spinner';
import { ProviderCard } from '../components/ProviderCard';
import { RatingStars } from '../components/RatingStars';
import { formatPrice } from '../format';
import { useLocale, t } from '@rafidain/shared';
import type { ApiRecord } from '../types';

const ITEM_ICONS: Record<string, string> = {
  products: '🛍️',
  menu: '🍽️',
  rooms: '🛏️',
  flights: '✈️',
  packages: '🧳',
};

const ITEM_LINKS: Record<string, (p: number | string, id: number | string) => string> = {
  products: (p, id) => `/item/${p}/products/${id}`,
  menu: (p, id) => `/item/${p}/menu/${id}`,
  packages: (p, id) => `/item/${p}/packages/${id}`,
  rooms: (p, id) => `/item/${p}/rooms/${id}`,
  flights: (p, id) => `/item/${p}/flights/${id}`,
};

function FavItemCard({ item }: { item: ApiRecord }) {
  useLocale();
  const navigate = useNavigate();
  const to = (ITEM_LINKS[item.kind] || ITEM_LINKS.products)(item.provider_id, item.id);
  return (
    <div className="card card--clickable" style={{ display: 'flex', gap: 12, padding: 10, marginBottom: 10 }} onClick={() => navigate(to)}>
      <div style={{ width: 64, height: 64, borderRadius: 10, overflow: 'hidden', flexShrink: 0, background: 'var(--soft-red)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>
        {item.image ? (
          <img src={item.image} alt={item.title} loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          ITEM_ICONS[item.kind] || '🛍️'
        )}
      </div>
      <div className="grow">
        <div style={{ fontWeight: 700, fontSize: 14 }}>{item.title}</div>
        {item.provider_name && (
          <div className="row" style={{ gap: 6 }}>
            <div className="muted" style={{ fontSize: 12 }}>{item.provider_name}</div>
            {item.provider_verified && <span className="deal-card__verified">{t('favorites.verified')}</span>}
          </div>
        )}
        <RatingStars rating={item.rating} count={item.rating_count} />
        <div className="row" style={{ gap: 6, marginTop: 4 }}>
          <span className="price">{formatPrice(item.price)}</span>
          <span className="muted">/ {item.unit}</span>
          {item.old_price ? <span className="price__old">{formatPrice(item.old_price)}</span> : null}
        </div>
        {item.sold > 0 && (
          <div className="deal-card__sold">🔥 {item.kind === 'products' ? t('favorites.sold', { count: Number(item.sold).toLocaleString('en-US') }) : t('favorites.ordered', { count: Number(item.sold).toLocaleString('en-US') })}</div>
        )}
      </div>
    </div>
  );
}

export default function Favorites() {
  useLocale();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { ids } = useFavorites();
  const [items, setItems] = useState<any>(null);
  const [favItems, setFavItems] = useState<any>(null);

  const load = () => {
    if (!user) return;
    customerApi.favorites().then(setItems).catch(() => setItems([]));
    customerApi.favoritesItems().then(setFavItems).catch(() => setFavItems([]));
  };

  useEffect(() => {
    load();
  }, [user, ids]);

  if (!user) {
    return (
      <div className="page">
        <div className="empty">
          <div className="empty__icon">❤️</div>
          <div className="empty__title">{t('favorites.loginTitle')}</div>
          <div className="empty__sub">{t('favorites.loginSub')}</div>
          <button className="btn btn--primary" onClick={() => navigate('/login')} type="button">{t('favorites.loginBtn')}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader title={t('favorites.title')} />

      <div className="section-title">{t('favorites.itemsTitle')}</div>
      {!favItems ? (
        <div className="centerpad"><Spinner /></div>
      ) : favItems.length === 0 ? (
        <EmptyState icon="🤍" title={t('favorites.emptyItems')} sub={t('favorites.emptyItemsSub')} />
      ) : (
        <div>
          {favItems.map((it: any) => (
            <FavItemCard key={`${it.kind}:${it.id}`} item={it} />
          ))}
          <div className="muted" style={{ textAlign: 'center', fontSize: 12, padding: '4px 0 12px' }}>
            {t('favorites.savedItems', { count: favItems.length })}
          </div>
        </div>
      )}

      <div className="section-title">{t('favorites.storesTitle')}</div>
      {!items ? (
        <div className="centerpad"><Spinner /></div>
      ) : items.length === 0 ? (
        <EmptyState icon="🏪" title={t('favorites.emptyStores')} sub={t('favorites.emptyStoresSub')} />
      ) : (
        <div>
          {items.map((p: any) => (
            <div key={p.id} style={{ marginBottom: 10 }}>
              <ProviderCard provider={p} />
            </div>
          ))}
          <div className="muted" style={{ textAlign: 'center', fontSize: 12, padding: '4px 0 12px' }}>
            {t('favorites.savedStores', { count: items.length })}
          </div>
        </div>
      )}
    </div>
  );
}
