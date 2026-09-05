import { useEffect, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { publicApi } from '../api';
import { useLocale, t } from '@rafidain/shared';

export default function PrivacyPolicy() {
  useLocale();
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    publicApi.content()
      .then((c: any) => setText(c?.privacy_policy || ''))
      .catch(() => setText(''))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="page">
      <PageHeader title={t('privacy.title')} />
      <div className="card">
        <div className="card-body">
          {loading ? (
            <div className="muted">{t('common.loading')}</div>
          ) : (
            <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8, fontSize: 14 }}>{text}</div>
          )}
        </div>
      </div>
    </div>
  );
}
