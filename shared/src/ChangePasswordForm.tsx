import { useState, type FormEvent } from 'react';
import { useToast, Field } from './ui';
import { t } from './i18n';
import { useLocale } from './LanguageSwitcher';

export function ChangePasswordForm({ api }: { api: any }) {
  const toast = useToast();
  useLocale();
  const [current_password, setCurrent] = useState('');
  const [new_password, setNew] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (new_password !== confirm) {
      toast.error(t('cpass.mismatch'));
      return;
    }
    setSaving(true);
    try {
      await api.post('/auth/change-password', { current_password, new_password });
      toast.success(t('cpass.done'));
      setCurrent('');
      setNew('');
      setConfirm('');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <Field label={t('cpass.current')} required>
        <input type="password" value={current_password} onChange={(e) => setCurrent(e.target.value)} required />
      </Field>
      <Field label={t('cpass.new')} required>
        <input type="password" value={new_password} onChange={(e) => setNew(e.target.value)} required />
      </Field>
      <Field label={t('cpass.confirm')} required>
        <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
      </Field>
      <button className="btn btn-primary" disabled={saving}>{saving ? t('cpass.saving') : t('cpass.title')}</button>
    </form>
  );
}
