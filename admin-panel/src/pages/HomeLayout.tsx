import { useEffect, useState } from 'react';
import { api } from '../api';
import { useToast, PageLoading, Toggle } from '@rafidain/shared/ui';
import { PageHead } from '@rafidain/shared/ui';
import { t } from '@rafidain/shared/i18n';
import { useLocale } from '@rafidain/shared';

export default function HomeLayout() {
  useLocale();
  const [sections, setSections] = useState<any[] | null>(null);
  const [initial, setInitial] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const load = () =>
    api.get('/public/home-layout').then((r) => {
      const list = r.data || [];
      setSections(list);
      setInitial(JSON.stringify(list));
    }).catch((e) => toast.error(e.message));

  useEffect(() => { load(); }, []);

  const move = (idx: number, dir: -1 | 1) => {
    if (!sections) return;
    const j = idx + dir;
    if (j < 0 || j >= sections.length) return;
    const copy = [...sections];
    [copy[idx], copy[j]] = [copy[j], copy[idx]];
    copy.forEach((s, i) => (s.order = i + 1));
    setSections(copy);
  };

  const toggle = (key: string) => {
    if (!sections) return;
    setSections(sections.map((s) => (s.key === key ? { ...s, enabled: !s.enabled } : s)));
  };

  const rename = (key: string, label: string) => {
    if (!sections) return;
    setSections(sections.map((s) => (s.key === key ? { ...s, label } : s)));
  };

  const addSection = () => {
    if (!sections) return;
    const key = `custom_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const copy = [...sections, { key, label: t('ad.homeLayout.newSection'), enabled: true, order: sections.length + 1, custom: true }];
    copy.forEach((s, i) => (s.order = i + 1));
    setSections(copy);
  };

  const removeSection = (key: string) => {
    if (!sections) return;
    const copy = sections.filter((s) => s.key !== key);
    copy.forEach((s, i) => (s.order = i + 1));
    setSections(copy);
  };

  const save = async () => {
    if (!sections) return;
    setSaving(true);
    try {
      await api.put('/public/home-layout', { value: JSON.stringify(sections) });
      toast.success(t('ad.homeLayout.saved'));
      setInitial(JSON.stringify(sections));
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  const reset = async () => {
    setSaving(true);
    try {
      await api.put('/public/home-layout', { value: '' });
      await load();
      toast.success(t('ad.homeLayout.resetDone'));
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  const dirty = !!sections && !!initial && JSON.stringify(sections) !== initial;

  if (!sections) return <PageLoading />;

  return (
    <div>
      <PageHead title={t('ad.homeLayout.title')} subtitle={t('ad.homeLayout.subtitle')} actions={<><div className="flex">
          <button className="btn btn-outline" onClick={reset} disabled={saving}>{t('ad.homeLayout.reset')}</button>
          <button className="btn btn-primary" onClick={save} disabled={saving || !dirty}>
            {saving ? t('ad.common.saving') : t('ad.homeLayout.saveBtn')}
          </button></div></>} />

      {dirty && <div className="alert alert-warning">{t('ad.homeLayout.unsaved')}</div>}

      <div className="card">
        <div className="flex" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
          <strong>{t('ad.homeLayout.sections', { count: sections.length })}</strong>
          <button className="btn btn-outline" onClick={addSection} disabled={saving}>＋ {t('ad.homeLayout.addSection')}</button>
        </div>
        <table>
          <thead><tr><th>#</th><th>{t('ad.homeLayout.sectionCol')}</th><th>{t('ad.homeLayout.orderCol')}</th><th>{t('ad.homeLayout.enabledCol')}</th><th></th></tr></thead>
          <tbody>
            {sections.map((s, i) => (
              <tr key={s.key}>
                <td className="mono">{s.order}</td>
                <td>
                  <div className="flex">
                    <input
                      className="input"
                      value={s.label}
                      onChange={(e) => rename(s.key, e.target.value)}
                      aria-label={`${t('ad.homeLayout.sectionNameAria')} ${s.label}`}
                      style={{ maxWidth: 260 }}
                    />
                    {s.custom && <span className="badge badge-blue">{t('ad.homeLayout.custom')}</span>}
                  </div>
                </td>
                <td>
                  <div className="flex">
                    <button className="btn btn-outline btn-sm" onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
                    <button className="btn btn-outline btn-sm" onClick={() => move(i, 1)} disabled={i === sections.length - 1}>↓</button>
                  </div>
                </td>
                <td><Toggle checked={!!s.enabled} onChange={() => toggle(s.key)} /></td>
                <td>
                  <button className="btn btn-danger btn-sm" onClick={() => removeSection(s.key)} disabled={saving} aria-label={`${t('ad.homeLayout.deleteAria')} ${s.label}`}>{t('ad.common.delete')}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
