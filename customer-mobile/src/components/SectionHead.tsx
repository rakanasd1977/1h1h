import { useNavigate } from 'react-router-dom';
import { useLocale, t } from '@rafidain/shared';

export function SectionHead({ icon = '', title = '', badge = '', moreTo = '' }: any) {
  const navigate = useNavigate();
  useLocale();
  return (
    <div className="section-head">
      <div className="section-head__title">
        {icon ? <span className="section-head__icon">{icon}</span> : null}
        <span>{title}</span>
        {badge ? <span className="section-head__badge">{badge}</span> : null}
      </div>
      {moreTo ? (
        <button className="section-more" type="button" onClick={() => navigate(moreTo)}>
          {t('common.more')} ›
        </button>
      ) : null}
    </div>
  );
}
