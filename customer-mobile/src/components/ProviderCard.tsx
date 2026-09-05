import { useNavigate } from 'react-router-dom';
import type { MouseEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { useFavorites } from '../context/FavoritesContext';
import { RatingStars } from './RatingStars';
import { useLocale, t } from '@rafidain/shared';

const COUNT_LABELS: Record<string, string> = {
  products: 'provider.count.products',
  menu_items: 'provider.count.menu',
  rooms: 'provider.count.rooms',
  flights: 'provider.count.flights',
  packages: 'provider.count.packages',
};

export function ProviderCard({ provider = {}, compact = false }: { provider?: any; compact?: boolean }) {
  useLocale();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isFavorite, toggle } = useFavorites();
  const counts: any = provider.catalog_counts || {};
  const countParts = Object.entries(counts)
    .filter(([, n]) => Number(n) > 0)
    .slice(0, 3)
    .map(([k, n]) => `${n} ${t(COUNT_LABELS[k] || k)}`);

  const name = provider.name || provider.name_ar;
  const serviceName = provider.service_name || provider.service_name_ar;
  const govName = provider.governorate_name || provider.governorate_name_ar;

  const fav = isFavorite(provider.id);

  const onHeart = (e: MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      navigate('/login');
      return;
    }
    toggle(provider.id);
  };

  if (compact) {
    return (
      <div className="card card--clickable provider-card provider-card--compact" onClick={() => navigate(`/provider/${provider.id}`)}>
        <div className="provider-card__logo" style={{ position: 'relative' }}>
          {provider.logo || (provider.service_icon ? provider.service_icon : '🏪')}
          <button
            className={`provider-card__fav${fav ? ' provider-card__fav--on' : ''}`}
            onClick={onHeart}
            type="button"
            aria-label={fav ? t('item.removeFromFav') : t('item.addToFav')}
          >
            {fav ? '❤️' : '🤍'}
          </button>
        </div>
        <div className="grow" style={{ width: '100%' }}>
          <div className="provider-card__name">{name}</div>
          <div className="provider-card__sub">{serviceName}</div>
          <div className="provider-card__sub">{govName}</div>
          <div className="row" style={{ justifyContent: 'center', marginTop: 6 }}>
            <RatingStars rating={provider.rating} count={provider.rating_count} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card card--clickable provider-card" onClick={() => navigate(`/provider/${provider.id}`)}>
      <div className="provider-card__logo" style={{ position: 'relative' }}>
        {provider.logo || (provider.service_icon ? provider.service_icon : '🏪')}
        <button
          className={`provider-card__fav${fav ? ' provider-card__fav--on' : ''}`}
          onClick={onHeart}
          type="button"
          aria-label={fav ? t('item.removeFromFav') : t('item.addToFav')}
        >
          {fav ? '❤️' : '🤍'}
        </button>
      </div>
      <div className="grow">
        <div className="provider-card__name">{name}</div>
        <div className="provider-card__sub">
          {govName} · {serviceName}
        </div>
        <div className="row row--between" style={{ marginTop: 6 }}>
          <RatingStars rating={provider.rating} count={provider.rating_count} />
          {provider.is_verified ? <span className="muted">{t('provider.verified')}</span> : null}
        </div>
        {countParts.length ? <div className="provider-card__sub">{countParts.join(' · ')}</div> : null}
      </div>
    </div>
  );
}