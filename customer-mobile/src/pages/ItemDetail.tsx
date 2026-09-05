import { useEffect, useState, type MouseEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { Toast } from '../components/Toast';
import { CenterSpinner } from '../components/Spinner';
import { ShareSheet } from '../components/ShareSheet';
import { RatingStars } from '../components/RatingStars';
import { RatingSummary } from '../components/RatingSummary';
import { ItemFavButton } from '../components/ItemFavButton';
import { QtyPicker } from '../components/QtyPicker';
import { Gallery } from '../components/Gallery';
import { ItemReviews } from '../components/ItemReviews';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useFavorites } from '../context/FavoritesContext';
import { useLocale, t } from '@rafidain/shared';
import { publicApi } from '../api';
import { formatPrice, discountPercent } from '../format';
import { trackRecent } from '../recentlyViewed';
import type { ItemKind } from '../types';

interface KindMeta {
  fetcher: string;
  icon: string;
  unit: string;
  label: string;
  service: string;
}

const KIND_META: Record<string, KindMeta> = {
  products: { fetcher: 'products', icon: '🛍️', unit: 'item.unit.product', label: 'item.kind.product', service: 'item.service.store' },
  menu: { fetcher: 'menu', icon: '🍽️', unit: 'item.unit.menu', label: 'item.kind.menu', service: 'item.service.restaurant' },
  packages: { fetcher: 'packages', icon: '🧳', unit: 'item.unit.package', label: 'item.kind.package', service: 'item.service.travel' },
  rooms: { fetcher: 'rooms', icon: '🛏️', unit: 'item.unit.room', label: 'item.kind.room', service: 'item.service.hotel' },
  flights: { fetcher: 'flights', icon: '✈️', unit: 'item.unit.flight', label: 'item.kind.flight', service: 'item.service.airline' },
};

function itemTitle(item: any): string {
  if (!item) return t('item.genericItem');
  return item.name_ar || `${item.origin_ar || item.origin || ''} ← ${item.destination_ar || item.destination || ''}` || t('item.genericItem');
}

function nightsBetween(a: string, b: string): number {
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return Math.max(1, Math.round(ms / 86400000));
}

export default function ItemDetail() {
  const { providerId, kind, itemId } = useParams();
  useLocale();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const { user } = useAuth();
  const { isItemFavorite, toggleItem } = useFavorites();
  if (!providerId || !itemId || !kind) return null;
  const meta = KIND_META[kind];
  if (!meta) return null;
  const [item, setItem] = useState<any>(null);
  const [provider, setProvider] = useState<any>(null);
  const [reviews, setReviews] = useState<any>(null);
  const [qty, setQty] = useState(1);
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [guests, setGuests] = useState(2);
  const [travelDate, setTravelDate] = useState('');
  const [passengers, setPassengers] = useState(1);
  const [showShare, setShowShare] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (!meta) return;
    let alive = true;
    const fetchers: Record<string, (id: number | string) => Promise<any>> = {
      products: publicApi.products,
      menu: publicApi.menu,
      packages: publicApi.packages,
      rooms: publicApi.rooms,
      flights: publicApi.flights,
    };
    fetchers[meta.fetcher](providerId || '')
      .then((res) => {
        const rows = Array.isArray(res) ? res : (res && res.rows) || [];
        const found = rows.find((r: any) => String(r.id) === String(itemId)) || null;
        if (!alive) return;
        setItem(found);
        if (found) {
          trackRecent({
            type: 'item',
            id: found.id,
            provider_id: Number(providerId),
            kind,
            title: itemTitle(found),
            image: (found.images && found.images[0]) || null,
            price: Number(kind === 'rooms' ? found.price_per_night : found.price),
          });
        }
      })
      .catch(() => alive && setItem(null));
    publicApi
      .provider(providerId || '')
      .then((p) => alive && setProvider(p))
      .catch(() => {});
    publicApi
      .itemReviews(kind, itemId || '')
      .then((res) => alive && setReviews(res))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [providerId, kind, itemId]);

  if (!meta) return null;

  if (!item) {
    return (
      <div>
        <PageHeader title={t('item.details')} />
        <CenterSpinner />
      </div>
    );
  }

  const images = item.images && item.images.length ? item.images : [];
  const discount = discountPercent(item.old_price, item.price);
  const unitPrice = kind === 'rooms' ? Number(item.price_per_night != null ? item.price_per_night : item.price) : Number(item.price);
  const title = itemTitle(item);
  const nights = kind === 'rooms' && checkIn && checkOut ? nightsBetween(checkIn, checkOut) : 1;
  const quantity = kind === 'rooms' ? nights : kind === 'flights' ? passengers : qty;

  const add = () => {
    if (kind === 'rooms') {
      if (!checkIn || !checkOut) {
        setToast(t('item.toast.roomDates'));
        return;
      }
      if (new Date(checkOut) <= new Date(checkIn)) {
        setToast(t('item.toast.checkoutAfter'));
        return;
      }
    }
    if (kind === 'flights' && !travelDate) {
      setToast(t('item.toast.flightDate'));
      return;
    }
    addItem({
      provider_id: Number(providerId),
      provider_name: item.provider_name || (provider && provider.name_ar),
      kind: kind as ItemKind,
      item_id: item.id,
      title,
      unit_price: unitPrice,
      quantity,
      unit: t(meta.unit),
      booking:
        kind === 'rooms'
          ? { type: 'hotels', check_in: checkIn, check_out: checkOut, guests, nights }
          : kind === 'flights'
          ? { type: 'flights', travel_date: travelDate, passengers }
          : undefined,
    });
    setToast(t('item.toast.added'));
  };

  const onHeart = (e: MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      navigate('/login');
      return;
    }
    toggleItem(kind, item.id);
  };
  const fav = isItemFavorite(kind, item.id);

  const facts = [];
  if (item.category_name) facts.push([t('item.fact.category'), item.category_name]);
  if (kind === 'products') {
    if (item.stock != null) facts.push([t('item.fact.stock'), item.stock > 0 ? `${item.stock} ${t(meta.unit)}` : t('item.fact.outOfStock')]);
  }
  if (kind === 'menu' && item.is_featured) facts.push([t('item.fact.featured'), t('item.fact.featuredMenuItem')]);
  if (kind === 'packages') {
    if (item.destination) facts.push([t('item.fact.destination'), item.destination]);
    if (item.duration_days) facts.push([t('item.fact.duration'), t('item.fact.days', { count: item.duration_days })]);
  }
  if (kind === 'rooms') {
    if (item.room_type) facts.push([t('item.fact.roomType'), item.room_type]);
    if (item.max_guests) facts.push([t('item.fact.capacity'), t('item.fact.guests', { count: item.max_guests })]);
    if (item.is_featured) facts.push([t('item.fact.featured'), t('item.fact.featuredRoom')]);
  }
  if (kind === 'flights') {
    if (item.airline) facts.push([t('item.fact.airline'), item.airline]);
    if (item.flight_number) facts.push([t('item.fact.flightNumber'), item.flight_number]);
    if (item.seats != null) facts.push([t('item.fact.seatsAvailable'), item.seats]);
    if (item.departure_at) facts.push([t('item.fact.departure'), item.departure_at]);
    if (item.arrival_at) facts.push([t('item.fact.arrival'), item.arrival_at]);
  }

  const showRating = Number((reviews && reviews.rating_count) || item.rating_count || 0) > 0;

  return (
    <div className="item-page">
      <PageHeader title={t(meta.label)} />

      <div className="detail-media">
        <Gallery images={images} icon={meta.icon} title={title} />
        {discount > 0 && <span className="product-card__off gallery__off">-{discount}%</span>}
        <ItemFavButton itemType={kind} itemId={item.id} className="itemfav--img itemfav--large gallery__fav" />
      </div>

      <div className="detail-body">
        <button className="btn btn--outline btn--sm share-btn" onClick={() => setShowShare(true)} type="button">
          {t('item.share')} 🔗
        </button>

        <div className="detail-title" style={{ marginTop: 10 }}>{title}</div>

        {showRating && (
          <div className="row" style={{ gap: 8, marginTop: 6 }}>
            <RatingStars rating={item.rating} count={item.rating_count} />
          </div>
        )}

        <div className="row" style={{ gap: 8, marginTop: 6 }}>
          <span className="price detail-price">{formatPrice(unitPrice)}<span className="price__suffix">/{t(meta.unit)}</span></span>
          {discount > 0 && (
            <span className="price__old">{formatPrice(item.old_price)}</span>
          )}
          {discount > 0 && (
            <span className="chip chip--active" style={{ padding: '2px 8px', fontSize: 11 }}>{t('item.discount', { value: discount })}</span>
          )}
        </div>

        {/* ===== ملخص التقييمات بأسلوب علي إكسبريس ===== */}
        {showRating && (
          <div className="card rsummary-card">
            <RatingSummary
              rating={(reviews && reviews.rating) || item.rating}
              count={(reviews && reviews.rating_count) || item.rating_count}
              breakdown={(reviews && reviews.breakdown) || []}
            />
          </div>
        )}

        {item.description && <p className="detail-desc">{item.description}</p>}

        {facts.length > 0 && (
          <div className="detail-facts">
            {facts.map(([k, v]) => (
              <div className="summary-row" key={k}>
                <span className="muted">{k}</span>
                <span style={{ fontWeight: 700, fontSize: 13 }}>{v}</span>
              </div>
            ))}
          </div>
        )}

        {kind === 'packages' && item.includes && item.includes.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div className="section-title" style={{ margin: '0 0 8px' }}>{t('item.included')}</div>
            {item.includes.map((inc: any, i: number) => (
              <div key={i} className="muted" style={{ padding: '3px 0' }}>✓ {inc}</div>
            ))}
          </div>
        )}

        {/* ===== سمعة البائع: بطاقة المزوّد ===== */}
        {provider && (
          <div className="card card--clickable provider-rep" onClick={() => navigate(`/provider/${provider.id}`)}>
            <div className="provider-rep__logo">
              {provider.logo && /^https?:/i.test(provider.logo) ? (
                <img src={provider.logo} alt="" decoding="async" />
              ) : (
                provider.logo || provider.service_icon || '🏪'
              )}
            </div>
            <div className="grow" style={{ minWidth: 0 }}>
              <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                <span className="provider-rep__name">{provider.name_ar}</span>
                {provider.is_verified ? <span className="deal-card__verified">✓ {t('item.verifiedProvider')}</span> : null}
              </div>
              <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                {provider.service_name_ar}{provider.governorate_name_ar ? ` · ${provider.governorate_name_ar}` : ''}
              </div>
              <div className="row" style={{ gap: 12, marginTop: 6 }}>
                <RatingStars rating={provider.rating} count={provider.rating_count} />
                <span className="provider-rep__follows">
                  👥 {t('item.followers', { count: Number(provider.followers_count || 0).toLocaleString('en-US') })}
                </span>
              </div>
            </div>
            <span className="provider-rep__arrow">‹</span>
          </div>
        )}

        <div className="divider" />
        {kind === 'rooms' && (
          <>
            <div className="row" style={{ gap: 10, marginBottom: 10 }}>
              <div className="grow">
                <label className="muted">{t('item.checkIn')}</label>
                <input className="input" type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
              </div>
              <div className="grow">
                <label className="muted">{t('item.checkOut')}</label>
                <input className="input" type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
              </div>
            </div>
            <div className="row" style={{ gap: 10 }}>
              <div className="grow">
                <label className="muted">{t('item.guests')}</label>
                <select className="input" value={guests} onChange={(e) => setGuests(Number(e.target.value))}>
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
              <div className="grow">
                <label className="muted">{t('item.nights')}</label>
                <div className="input" style={{ fontWeight: 800, color: 'var(--brand)' }}>{nights}</div>
              </div>
            </div>
          </>
        )}
        {kind === 'flights' && (
          <div className="row" style={{ gap: 10 }}>
            <div className="grow">
              <label className="muted">{t('item.travelDate')}</label>
              <input className="input" type="date" value={travelDate} onChange={(e) => setTravelDate(e.target.value)} />
            </div>
            <div className="grow">
              <label className="muted">{t('item.passengers')}</label>
              <select className="input" value={passengers} onChange={(e) => setPassengers(Number(e.target.value))}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          </div>
        )}
        {kind !== 'rooms' && kind !== 'flights' && (
          <div className="qtyrow">
            <span className="muted">{t('item.qty')}</span>
            <QtyPicker
              value={qty}
              onChange={setQty}
              max={kind === 'products' && item.stock > 0 ? item.stock : undefined}
            />
          </div>
        )}
        <div style={{ height: 84 }} />
      </div>

      {/* ===== التقييمات ===== */}
      <div className="detail-body" style={{ paddingTop: 0 }}>
        <div className="section-title">⭐ {t('item.reviewsTitle')}</div>
        <ItemReviews kind={kind} itemId={item.id} onToast={setToast} />
      </div>

      <div className="buybar">
        <div>
          <div className="muted">{t('item.total')}</div>
          <div className="price" style={{ fontSize: 18 }}>{formatPrice(unitPrice * quantity)}</div>
        </div>
        <button
          className={`buybar__fav${fav ? ' buybar__fav--on' : ''}`}
          onClick={onHeart}
          type="button"
          aria-label={fav ? t('item.removeFromFav') : t('item.addToFav')}
        >
          {fav ? '❤️' : '🤍'}
        </button>
        <button className="btn btn--primary buybar__btn" onClick={add} type="button">
          🛒 {t('item.addToCart')}
        </button>
      </div>

      <ShareSheet
        open={showShare}
        onClose={() => setShowShare(false)}
        title={title}
        url={window.location.href}
        onCopied={() => setToast(t('item.toast.copied'))}
      />
      <Toast message={toast} onClose={() => setToast('')} />
    </div>
  );
}
