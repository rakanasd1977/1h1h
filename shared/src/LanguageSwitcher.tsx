import { useEffect, useState, memo } from 'react';
import { getLocale, setLocale, subscribeLocale, t, type Locale } from './i18n';

export function useLocale(): Locale {
  const [locale, setLocal] = useState<Locale>(getLocale());
  useEffect(() => subscribeLocale(setLocal), []);
  return locale;
}

export const LanguageSwitcher = memo(function LanguageSwitcher({
  className = '',
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const locale = useLocale();
  const other: Locale = locale === 'ar' ? 'en' : 'ar';
  const label = t('common.language');

  return (
    <button
      type="button"
      className={`lang-switcher${compact ? ' lang-switcher--compact' : ''}${className ? ' ' + className : ''}`}
      onClick={() => setLocale(other)}
      aria-label={label}
      title={label}
    >
      {compact ? (
        <span className="lang-switcher__short">{other === 'en' ? 'EN' : 'ع'}</span>
      ) : (
        <span className="lang-switcher__full">{other === 'en' ? 'English' : 'العربية'}</span>
      )}
    </button>
  );
});