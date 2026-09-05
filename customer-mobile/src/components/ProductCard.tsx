import { useNavigate } from 'react-router-dom';
import { formatPrice, discountPercent } from '../format';
import { useLocale, t } from '@rafidain/shared';
import { RatingStars } from './RatingStars';
import { ItemFavButton } from './ItemFavButton';
import type { ApiRecord } from '../types';

export function ProductCard({ item, to, icon = '🛍️', unit }: { item: ApiRecord; to: string; icon?: string; unit?: string }) {
  const navigate = useNavigate();
  useLocale();
  const discount = discountPercent(item.old_price, item.price);
  const image = (item.images && item.images[0]) || item.image;
  const u = unit || t('product.unit');
  const soldLabel = item.kind === 'products' ? t('deal.soldProducts') : t('deal.soldOrders');

  return (
    <div className="card card--clickable product-card" onClick={() => navigate(to)}>
      <div className="product-card__img">
        {image ? (
          <img src={image} alt={item.title || item.name_ar} loading="lazy" decoding="async" />
        ) : (
          <span>{icon}</span>
        )}
        {discount > 0 && <span className="product-card__off">-{discount}%</span>}
        <ItemFavButton itemType={item.kind || 'products'} itemId={item.id} className="itemfav--img" />
      </div>
      <div className="product-card__body">
        <div className="product-card__title">{item.title || item.name_ar}</div>
        <RatingStars rating={item.rating} count={item.rating_count} />
        <div className="row row--between" style={{ marginTop: 6 }}>
          <span className="price">
            {formatPrice(item.price)}
            <span className="price__suffix">/{u}</span>
          </span>
          {discount > 0 && <span className="price__old">{formatPrice(item.old_price)}</span>}
        </div>
        {item.sold > 0 && <div className="deal-card__sold">🔥 {soldLabel} {Number(item.sold).toLocaleString('en-US')}</div>}
        {item.provider_verified && <div className="deal-card__verified">{t('deal.verified')}</div>}
      </div>
    </div>
  );
}
