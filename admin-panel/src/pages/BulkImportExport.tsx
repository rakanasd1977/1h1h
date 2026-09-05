import { useState } from 'react';
import { api } from '../api';
import { useToast, Confirm } from '@rafidain/shared/ui';
import { PageHead } from '@rafidain/shared/ui';
import { t } from '@rafidain/shared/i18n';
import { useLocale } from '@rafidain/shared';

const ENTITIES = [
  { key: 'agents', labelKey: 'ad.bulk.agents', icon: '🤝' },
  { key: 'providers', labelKey: 'ad.bulk.providers', icon: '🏪' },
  { key: 'products', labelKey: 'ad.bulk.products', icon: '📦' },
  { key: 'coupons', labelKey: 'ad.bulk.coupons', icon: '🎫' },
];

const ENTITY_LABELS = { agents: 'ad.bulk.agents', providers: 'ad.bulk.providers', products: 'ad.bulk.products', coupons: 'ad.bulk.coupons' };

export default function BulkImportExport() {
  useLocale();
  const [entity, setEntity] = useState('agents');
  const [step, setStep] = useState('select'); // select, preview, import
  const [preview, setPreview] = useState<any>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [exportLoading, setExportLoading] = useState(false);
  const toast = useToast();

  const loadTemplate = (e: any) => {
    window.open(`/api/bulk/template/${e}`, '_blank');
    toast.success(t('ad.bulk.templateLoading', { entity: t(ENTITY_LABELS[e as keyof typeof ENTITY_LABELS]) }));
  };

  const handleFile = async (file: any) => {
    if (!file.name.endsWith('.csv')) { toast.error(t('ad.bulk.csvRequired')); return; }
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await api.post(`/bulk/preview/${entity}`, form);
      setPreview(res.data);
      setStep('preview');
    } catch (e: any) { toast.error(e.message); }
  };

  const doImport = async (skipErrors = false) => {
    if (!preview) return;
    setImporting(true);
    try {
      const form = new FormData();
      form.append('file', preview.file);
      form.append('skipErrors', String(skipErrors));
      const res = await api.post(`/bulk/import/${entity}`, form);
      setImportResult(res.data);
      toast.success(t('ad.bulk.importSuccess', { count: res.data.count }));
      setStep('select');
      setPreview(null);
    } catch (e: any) { toast.error(e.message); }
    finally { setImporting(false); }
  };

  const doExport = async () => {
    setExportLoading(true);
    try {
      const blob = await api.get(`/bulk/export/${entity}`, { responseType: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${entity}-export-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(t('ad.bulk.exportDone'));
    } catch (e: any) { toast.error(e.message); }
    finally { setExportLoading(false); }
  };

  if (!preview) {
    return (
      <div>
        <PageHead title={t('ad.bulk.title')} subtitle={t('ad.bulk.subtitle')} />

        <div className="grid grid-4 mb-4">
          {ENTITIES.map(e => (
            <div key={e.key} className="card" style={{ cursor: 'pointer', textAlign: 'center', padding: 24 }} onClick={() => setEntity(e.key)}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>{e.icon}</div>
              <div className="bold">{t(e.labelKey)}</div>
              <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{entity === e.key ? t('ad.bulk.selected') : t('ad.bulk.clickToSelect')}</div>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="card-header"><h3>{t('ad.bulk.actionsTitle', { entity: t(ENTITY_LABELS[entity as keyof typeof ENTITY_LABELS]) })}</h3></div>
          <div className="card-body" style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <button className="btn btn-primary" onClick={() => loadTemplate(entity)}>
              ⬇ {t('ad.bulk.downloadTemplate')}
            </button>
            <label className="btn btn-outline" style={{ cursor: 'pointer' }}>
              📤 {t('ad.bulk.chooseFile')}
              <input type="file" accept=".csv" style={{ display: 'none' }} onChange={(e: any) => handleFile(e.target.files[0])} />
            </label>
            <button className="btn btn-outline" onClick={doExport} disabled={exportLoading}>
              {exportLoading ? t('ad.bulk.exporting') : `⬇ ${t('ad.bulk.exportData')}`}
            </button>
          </div>
          <div className="alert-info mt-3" style={{ fontSize: 13 }}>
            <strong>{t('ad.bulk.importSteps')}:</strong>
            {t('ad.bulk.importStepsBody')}
          </div>
        </div>
      </div>
    );
  }

  // Preview step
  const { total, valid, invalid, preview: previewRows, errors } = preview;

  return (
    <div>
      <PageHead title={t('ad.bulk.previewTitle', { entity: t(ENTITY_LABELS[entity as keyof typeof ENTITY_LABELS]) })} subtitle={<>{t('ad.bulk.total', { total })} | {t('ad.bulk.valid', { valid })}: <span className="badge badge-green">{valid}</span> | {t('ad.bulk.invalid', { invalid })}: <span className="badge badge-red">{invalid}</span></>} actions={<><div className="flex gap-sm">
          <button className="btn btn-outline" onClick={() => { setPreview(null); setStep('select'); }}>← {t('ad.bulk.changeEntity')}</button>
          <button className="btn btn-outline" onClick={() => doImport(false)} disabled={importing || valid === 0}>{t('ad.bulk.importStopOnError')}</button>
          {invalid > 0 && (
            <button className="btn btn-warning" onClick={() => doImport(true)} disabled={importing}>
              {t('ad.bulk.importSkipErrors', { invalid })}
            </button>
          )}</div></>} />

      {invalid > 0 && (
        <div className="card mb-4">
          <div className="card-header flex-between">
            <h3>{t('ad.bulk.errorsTitle', { invalid })}</h3>
            <span className="badge badge-red">{t('ad.bulk.notImported')}</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>{t('ad.bulk.thRow')}</th><th>{t('ad.bulk.thErrors')}</th><th>{t('ad.bulk.thData')}</th></tr></thead>
              <tbody>
                {errors.map((e: any, i: any) => (
                  <tr key={i}>
                    <td className="mono">{e.rowNum}</td>
                    <td><span className="badge badge-red">{e.errors.join(', ')}</span></td>
                    <td className="muted mono" style={{ maxWidth: 300, fontSize: 11 }}>{JSON.stringify(e.data).slice(0, 200)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {valid > 0 && (
        <div className="card mb-4">
          <div className="card-header"><h3>{t('ad.bulk.validDataTitle', { valid })}</h3></div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {previewRows[0] && Object.keys(previewRows[0].data).map(k => <th key={k}>{k}</th>)}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((r: any, i: any) => (
                  <tr key={i}>
                    {Object.values(r.data).map((v, j) => <td key={j} className="muted mono" style={{ fontSize: 12 }}>{String(v).slice(0, 50)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Confirm open={!!importResult} title={t('ad.bulk.importDoneTitle')} message={t('ad.bulk.importDoneMsg', { count: importResult?.count, errors: importResult?.errors?.length || 0 })} onConfirm={() => { setImportResult(null); setStep('select'); }} onCancel={() => { setImportResult(null); setStep('select'); }} />
    </div>
  );
}