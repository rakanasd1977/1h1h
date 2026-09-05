import { useEffect, useState } from 'react';
import { api } from '../api';
import { useToast, PageLoading } from '@rafidain/shared/ui';
import { PageHead } from '@rafidain/shared/ui';
import { t } from '@rafidain/shared/i18n';
import { useLocale } from '@rafidain/shared';

type FaqItem = { question: string; answer: string };

export default function ContentManager() {
  useLocale();
  const [tab, setTab] = useState<'privacy' | 'faq'>('privacy');
  const [privacy, setPrivacy] = useState('');
  const [initialPrivacy, setInitialPrivacy] = useState('');
  const [faq, setFaq] = useState<FaqItem[]>([]);
  const [initialFaq, setInitialFaq] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const [savingFaq, setSavingFaq] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const toast = useToast();

  useEffect(() => {
    (async () => {
      try {
        try {
          const pp = await api.get('/settings/privacy_policy');
          const val = pp?.data?.privacy_policy?.value || '';
          setPrivacy(val);
          setInitialPrivacy(val);
        } catch (e: any) {
          if (e?.status !== 404) toast.error(e?.message || t('ad.content.privacyLoadError'));
        }
        try {
          const fq = await api.get('/settings/faq');
          let arr: FaqItem[] = [];
          if (fq?.data?.faq?.value) {
            try { arr = JSON.parse(fq.data.faq.value); } catch { arr = []; }
          }
          const list = Array.isArray(arr) ? arr : [];
          setFaq(list);
          setInitialFaq(JSON.stringify(list));
        } catch (e: any) {
          if (e?.status !== 404) toast.error(e?.message || t('ad.content.faqLoadError'));
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const privacyDirty = privacy !== initialPrivacy;
  const faqDirty = JSON.stringify(faq) !== initialFaq;

  const savePrivacy = async () => {
    setSavingPrivacy(true);
    try {
      await api.put('/settings/privacy_policy', { value: privacy, label: 'سياسة الخصوصية' });
      setInitialPrivacy(privacy);
      toast.success(t('ad.content.privacySaved'));
    } catch (e: any) {
      toast.error(e?.message || t('ad.content.saveFailed'));
    } finally {
      setSavingPrivacy(false);
    }
  };

  const saveFaq = async () => {
    setSavingFaq(true);
    try {
      await api.put('/settings/faq', { value: JSON.stringify(faq), label: 'الأسئلة الشائعة' });
      setInitialFaq(JSON.stringify(faq));
      toast.success(t('ad.content.faqSaved'));
    } catch (e: any) {
      toast.error(e?.message || t('ad.content.saveFailed'));
    } finally {
      setSavingFaq(false);
    }
  };

  const updateFaq = (i: number, field: keyof FaqItem, val: string) =>
    setFaq((prev) => prev.map((it, idx) => (idx === i ? { ...it, [field]: val } : it)));
  const addFaq = () => setFaq((prev) => [...prev, { question: '', answer: '' }]);
  const removeFaq = (i: number) => setFaq((prev) => prev.filter((_, idx) => idx !== i));
  const moveFaq = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= faq.length) return;
    const copy = [...faq];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    setFaq(copy);
  };

  if (loading) return <PageLoading />;

  return (
    <div>
      <PageHead title={t('ad.content.title')} subtitle={t('ad.content.subtitle')} />

      <div className="tabs">
        <button className={`tab ${tab === 'privacy' ? 'tab--active' : ''}`} onClick={() => setTab('privacy')}>{t('ad.content.tabPrivacy')}</button>
        <button className={`tab ${tab === 'faq' ? 'tab--active' : ''}`} onClick={() => setTab('faq')}>{t('ad.content.tabFaq')} ({faq.length})</button>
      </div>

      {tab === 'privacy' && (
        <div className="card">
          <div className="card-body">
            <div className="flex-between mb-3">
              <strong>{t('ad.content.privacyBody')}</strong>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowPreview((s) => !s)} type="button">
                {showPreview ? t('ad.content.hidePreview') : t('ad.content.preview')}
              </button>
            </div>
            {showPreview ? (
              <div className="doc-preview-box" style={{ whiteSpace: 'pre-wrap', direction: 'rtl', lineHeight: 1.8, padding: 16, border: '1px solid var(--border)', borderRadius: 12, background: '#fff', minHeight: 200 }}>
                {privacy || <span className="muted">{t('ad.content.noPreviewText')}</span>}
              </div>
            ) : (
              <div className="field">
                <label>{t('ad.content.content')}</label>
                <textarea
                  rows={18}
                  value={privacy}
                  onChange={(e) => setPrivacy(e.target.value)}
                  placeholder={t('ad.content.privacyPlaceholder')}
                  style={{ width: '100%', resize: 'vertical' }}
                />
                <span className="field-hint">{t('ad.content.charCount', { count: privacy.length })}</span>
              </div>
            )}
            <div className="form-actions">
              {privacyDirty && <span className="badge badge-amber">{t('ad.content.unsaved')}</span>}
              <button className="btn btn-primary" onClick={savePrivacy} disabled={savingPrivacy || !privacyDirty} type="button">
                {savingPrivacy ? t('ad.content.saving') : t('ad.content.savePrivacy')}
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === 'faq' && (
        <div className="card">
          <div className="card-body">
            <div className="flex-between mb-3">
              <strong>{t('ad.content.faqTitle')}</strong>
              <button className="btn btn-outline btn-sm" onClick={addFaq} type="button">＋ {t('ad.content.addQuestion')}</button>
            </div>

            {faq.length === 0 && (
              <div className="empty-state">
                <div className="big">💬</div>
                {t('ad.content.noQuestions')}
              </div>
            )}

            {faq.map((it, i) => (
              <div key={i} className="faq-edit-card">
                <div className="flex-between" style={{ marginBottom: 10 }}>
                  <div className="flex gap-sm">
                    <span className="badge badge-gray">#{i + 1}</span>
                    <button className="btn btn-outline btn-sm" onClick={() => moveFaq(i, -1)} disabled={i === 0} type="button" aria-label={t('ad.content.moveUp')}>↑</button>
                    <button className="btn btn-outline btn-sm" onClick={() => moveFaq(i, 1)} disabled={i === faq.length - 1} type="button" aria-label={t('ad.content.moveDown')}>↓</button>
                  </div>
                  <button className="btn btn-danger btn-sm" onClick={() => removeFaq(i)} type="button">{t('ad.common.delete')}</button>
                </div>
                <div className="field">
                  <label>{t('ad.content.question')}</label>
                  <input value={it.question} onChange={(e) => updateFaq(i, 'question', e.target.value)} placeholder={t('ad.content.questionPlaceholder')} />
                </div>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label>{t('ad.content.answer')}</label>
                  <textarea rows={3} value={it.answer} onChange={(e) => updateFaq(i, 'answer', e.target.value)} placeholder={t('ad.content.answerPlaceholder')} style={{ width: '100%', resize: 'vertical' }} />
                </div>
              </div>
            ))}

            <div className="form-actions">
              {faqDirty && <span className="badge badge-amber">{t('ad.content.unsaved')}</span>}
              <button className="btn btn-primary" onClick={saveFaq} disabled={savingFaq || !faqDirty} type="button">
                {savingFaq ? t('ad.content.saving') : t('ad.content.saveFaq')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
