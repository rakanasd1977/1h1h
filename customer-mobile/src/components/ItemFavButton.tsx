import { useNavigate } from 'react-router-dom';
import type { MouseEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { useFavorites } from '../context/FavoritesContext';
import { t } from '@rafidain/shared';

export function ItemFavButton({ itemType, itemId, className = '' }: { itemType: string; itemId: number | string; className?: string }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isItemFavorite, toggleItem } = useFavorites();
  const fav = isItemFavorite(itemType, itemId);

  const onToggle = (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!user) {
      navigate('/login');
      return;
    }
    toggleItem(itemType, itemId);
  };

  return (
    <button
      className={`itemfav${fav ? ' itemfav--on' : ''}${className ? ` ${className}` : ''}`}
      onClick={onToggle}
      type="button"
      aria-label={fav ? t('item.removeFromFav') : t('item.addToFav')}
    >
      {fav ? '❤️' : '🤍'}
    </button>
  );
}
