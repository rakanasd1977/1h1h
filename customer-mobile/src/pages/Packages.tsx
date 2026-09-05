import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { Toast } from '../components/Toast';
import { EmptyState } from '../components/EmptyState';
import { CenterSpinner } from '../components/Spinner';
import { ItemFavButton } from '../components/ItemFavButton';
import { useCart } from '../context/CartContext';
import { useLocale, t } from '@rafidain/shared';
import { publicApi } from '../api';

export default function Packages() {
  useLocale();
  const { id } = useParams();
  const { addItem } = useCart();
  const [pkgs, setPkgs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');

  useEffect(() => {
    publicApi
      .packages(id || '')
      .then((rows) => setPkgs(rows || []))
      .catch(() => setPkgs([]))
      .finally(() => setLoading(false));
  }, [id]);

  const pick = (p: any) => {
    const title = p.name || p.name_ar;
    addItem({
      provider_id: Number(id),
      provider_name: p.provider_name,
      kind: 'packages',
      item_id: p.id,
      title,
      unit_price: Number(p.price),
      quantity: 1,
      unit: t('item.unit.package'),
      booking: { type: 'travel_offices', title, travelers: 1 },
    });
    setToast(t('packages.added'));
  };

  return (
    <div>
      <PageHeader title={t('packages.title')} />
      <div className="page page--no-nav">
        {loading ? (
          <CenterSpinner />
        ) : pkgs.length ? (
          pkgs.map((p) => {
            const title = p.name || p.name_ar;
            return (
            <div className="card" key={p.id} style={{ marginBottom: 12 }}>
              <div className="detail-img" style={{ height: 130, fontSize: 48 }}>
                {p.images && p.images[0] ? (
                  <img src={p.images[0]} alt={title} loading="lazy" decoding="async" />
                ) : (
                  '🧳'
                )}
                <ItemFavButton itemType="packages" itemId={p.id} className="itemfav--img" />
              </div>
              <div className="product-card__body">
                <div style={{ fontWeight: 800, fontSize: 15 }}>{title}</div>
                {p.destination && <div className="muted" style={{ marginTop: 2 }}>📍 {p.destination}</div>}
                <div className="muted">{t('packages.days', { count: p.duration_days })}</div>
                {p.description && <div className="muted" style={{ marginTop: 4 }}>{p.description}</div>}
                {p.includes && p.includes.length > 0 && (
                  <div className="muted" style={{ marginTop: 4 }}>✓ {p.includes.join(' · ')}</div>
                )}
                <div className="row row--between" style={{ marginTop: 10 }}>
                  <span className="price">{p.price.toLocaleString('en-US')} د.ع</span>
                  <button className="btn btn--primary btn--sm" onClick={() => pick(p)} type="button">{t('packages.book')}</button>
                </div>
              </div>
            </div>
            );
          })
        ) : (
          <EmptyState icon="🧳" title={t('packages.emptyTitle')} sub={t('packages.emptySub')} />
        )}
      </div>
      <Toast message={toast} onClose={() => setToast('')} />
    </div>
  );
}
