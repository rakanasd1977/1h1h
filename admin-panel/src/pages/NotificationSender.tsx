import { useState, useEffect } from 'react';
import { api } from '../api';
import { useToast } from '@rafidain/shared/ui';
import { PageHead } from '@rafidain/shared/ui';
import { t } from '@rafidain/shared/i18n';
import { useLocale } from '@rafidain/shared';

export default function NotificationSender() {
  useLocale();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [target, setTarget] = useState<'all' | 'role' | 'governorate'>('all');
  const [role, setRole] = useState('customer');
  const [governorateId, setGovernorateId] = useState('');
  const [url, setUrl] = useState('');
  const [icon, setIcon] = useState('📢');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [governorates, setGovernorates] = useState<any[]>([]);
  const toast = useToast();

  useEffect(() => { api.get('/governorates').then((r) => setGovernorates(r.data || [])).catch(() => {}); }, []);

  const send = async () => {
    if (!title.trim() || !body.trim()) { toast.error(t('ad.notif.titleBodyRequired')); return; }
    setSending(true);
    setResult(null);
    try {
      const res = await api.post('/admin/notifications/send', {
        title, body, target, role: target === 'role' ? role : undefined,
        governorate_id: target === 'governorate' ? Number(governorateId) : undefined, url, icon,
      });
      setResult(res.data);
      toast.success(t('ad.notif.sent', { count: res.data.recipients }));
    } catch (e: any) { toast.error(e.message); } finally { setSending(false); }
  };

  return (
    <div>
      <PageHead title={t('ad.notif.title')} subtitle={t('ad.notif.subtitle')} />

      <div className="card form-card">
        <div className="form-grid">
          <div className="field full">
            <label>{t('ad.notif.titleLabel')} *</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('ad.notif.titlePlaceholder')} />
          </div>
          <div className="field full">
            <label>{t('ad.notif.bodyLabel')} *</label>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder={t('ad.notif.bodyPlaceholder')} />
          </div>
          <div className="field">
            <label>{t('ad.notif.targetLabel')}</label>
            <select value={target} onChange={(e) => setTarget(e.target.value as any)}>
              <option value="all">{t('ad.notif.targetAll')}</option>
              <option value="role">{t('ad.notif.targetRole')}</option>
              <option value="governorate">{t('ad.notif.targetGovernorate')}</option>
            </select>
          </div>
          {target === 'role' && (
            <div className="field">
              <label>{t('ad.notif.role')}</label>
              <select value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="customer">{t('ad.notif.roleCustomers')}</option>
                <option value="provider">{t('ad.notif.roleProviders')}</option>
                <option value="agent">{t('ad.notif.roleAgents')}</option>
              </select>
            </div>
          )}
          {target === 'governorate' && (
            <div className="field">
              <label>{t('ad.agent.gov')}</label>
              <select value={governorateId} onChange={(e) => setGovernorateId(e.target.value)}>
                <option value="">{t('ad.notif.chooseGovernorate')}</option>
                {governorates.map((g) => <option key={g.id} value={g.id}>{g.name_ar}</option>)}
              </select>
            </div>
          )}
          <div className="field">
            <label>{t('ad.notif.iconLabel')}</label>
            <input value={icon} onChange={(e) => setIcon(e.target.value)} maxLength={4} />
          </div>
          <div className="field full">
            <label>{t('ad.notif.urlLabel')}</label>
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="/deals" />
          </div>
        </div>
        <div className="form-actions">
          <button className="btn btn-primary" onClick={send} disabled={sending}>{sending ? t('ad.notif.sending') : t('ad.notif.sendBtn')}</button>
        </div>
        {result && (
          <div className="alert success">
            {t('ad.notif.resultNote', { recipients: result.recipients, push_sent: result.push_sent })}
          </div>
        )}
      </div>
    </div>
  );
}
