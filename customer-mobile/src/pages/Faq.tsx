import { useEffect, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { publicApi } from '../api';
import { useLocale, t } from '@rafidain/shared';

type FaqItem = { question: string; answer: string };

export default function Faq() {
  useLocale();
  const [faq, setFaq] = useState<FaqItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<number | null>(0);

  useEffect(() => {
    publicApi.content()
      .then((c: any) => setFaq(Array.isArray(c?.faq) ? c.faq : []))
      .catch(() => setFaq([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="page">
      <PageHeader title={t('faq.title')} />
      <div className="card">
        <div className="card-body">
          {loading ? (
            <div className="muted">{t('common.loading')}</div>
          ) : faq.length === 0 ? (
            <div className="muted">{t('faq.empty')}</div>
          ) : (
            faq.map((it, i) => (
              <div key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                <button
                  type="button"
                  onClick={() => setOpen(open === i ? null : i)}
                  style={{ width: '100%', textAlign: 'right', background: 'none', border: 'none', padding: '14px 0', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}
                >
                  {open === i ? '▼ ' : '▶ '}{it.question}
                </button>
                {open === i && (
                  <div style={{ paddingBottom: 14, color: 'var(--text-muted)', lineHeight: 1.7, fontSize: 14 }}>
                    {it.answer}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
