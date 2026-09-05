import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { Toast } from '../components/Toast';
import { Spinner } from '../components/Spinner';
import { useAuth } from '../context/AuthContext';
import { customerApi, publicApi, authApi, uploadApi } from '../api';
import { useLocale, t } from '@rafidain/shared';

const AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

export default function ProfileEdit() {
  useLocale();
  const { refreshUser } = useAuth();
  const navigate = useNavigate();
  const [governorates, setGovernorates] = useState<any[]>([]);
  const [form, setForm] = useState({ name_ar: '', phone: '', governorate_id: '', address: '', avatar: '' });
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState({ current_password: '', new_password: '' });
  const [pwBusy, setPwBusy] = useState(false);

  const [currentEmail, setCurrentEmail] = useState('');
  const [emailOpen, setEmailOpen] = useState(false);
  const [ecEmail, setEcEmail] = useState('');
  const [ecPassword, setEcPassword] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    Promise.all([customerApi.profile(), publicApi.governorates()])
      .then(([p, govs]) => {
        setGovernorates(govs || []);
        setCurrentEmail(p.user.email || '');
        setForm({
          name_ar: p.user.name_ar || '',
          phone: p.user.phone || '',
          governorate_id: p.user.governorate_id ? String(p.user.governorate_id) : '',
          address: (p.customer && p.customer.address) || '',
          avatar: p.user.avatar || '',
        });
      })
      .catch(() => {});
  }, []);

  const submit = async (e: any) => {
    e.preventDefault();
    setBusy(true);
    setToast('');
    try {
      await customerApi.updateProfile({
        name_ar: form.name_ar,
        phone: form.phone || undefined,
        governorate_id: form.governorate_id ? Number(form.governorate_id) : null,
        address: form.address || undefined,
        avatar: form.avatar,
      });
      await refreshUser();
      navigate('/profile');
    } catch (err: any) {
      setToast(err.message);
    } finally {
      setBusy(false);
    }
  };

  const pickAvatar = async (e: any) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (!AVATAR_TYPES.includes(file.type)) {
      setToast(t('pe.avatarTypeError'));
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setToast(t('pe.avatarSizeError'));
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = String(reader.result || '');
      setPreview(dataUrl);
      setUploading(true);
      setToast('');
      try {
        const up: any = await uploadApi.avatar(dataUrl);
        setForm((f) => ({ ...f, avatar: up.url }));
      } catch (err: any) {
        setToast(err.message || t('pe.uploadFailed'));
      } finally {
        setUploading(false);
        setPreview('');
      }
    };
    reader.readAsDataURL(file);
  };

  const changePw = async (e: any) => {
    e.preventDefault();
    setPwBusy(true);
    setToast('');
    try {
      await authApi.changePassword(pw.current_password, pw.new_password);
      setPwOpen(false);
      setPw({ current_password: '', new_password: '' });
      setToast(t('pe.passwordChanged'));
    } catch (err: any) {
      setToast(err.message);
    } finally {
      setPwBusy(false);
    }
  };

  const changeEmail = async (e: any) => {
    e.preventDefault();
    if (!ecEmail || !ecPassword) {
      setToast(t('pe.emailFill'));
      return;
    }
    setEmailBusy(true);
    setToast('');
    try {
      const res: any = await authApi.changeEmail(ecEmail, ecPassword);
      navigate(`/verify?token=${encodeURIComponent(res.verification_token)}&email=${encodeURIComponent(ecEmail.trim().toLowerCase())}`);
    } catch (err: any) {
      setToast(err.message);
    } finally {
      setEmailBusy(false);
    }
  };

  const avatarSrc = preview || form.avatar;

  return (
    <div>
      <PageHeader title={t('pe.title')} />
      <div className="page page--no-nav">
        <form className="card" style={{ padding: 16 }} onSubmit={submit}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
            <div
              style={{
                width: 64, height: 64, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
                background: 'var(--surface2)', border: '2px solid var(--brand2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28,
              }}
            >
              {avatarSrc ? <img src={avatarSrc} alt={t('pe.avatarAlt')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '👤'}
            </div>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? t('pe.uploading') : (form.avatar ? t('pe.changePhoto') : t('pe.addPhoto'))}
              </button>
              {form.avatar && (
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setForm((f) => ({ ...f, avatar: '' }))}>
                  {t('pe.removePhoto')}
                </button>
              )}
            </div>
          </div>
          <input ref={fileRef} type="file" accept={AVATAR_TYPES.join(',')} style={{ display: 'none' }} onChange={pickAvatar} />

          <div className="field">
            <label>{t('pe.nameField')}</label>
            <input className="input" value={form.name_ar} onChange={(e) => setForm((f) => ({ ...f, name_ar: e.target.value }))} />
          </div>
          <div className="field">
            <label>{t('pe.phoneField')}</label>
            <input className="input" dir="ltr" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          </div>
          <div className="field">
            <label>{t('pe.govField')}</label>
            <select className="input" value={form.governorate_id} onChange={(e) => setForm((f) => ({ ...f, governorate_id: e.target.value }))}>
              <option value="">{t('pe.none')}</option>
              {governorates.map((g) => (
                <option key={g.id} value={g.id}>{g.name || g.name_ar}</option>
              ))}
            </select>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>{t('pe.addressField')}</label>
            <textarea className="input" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
          </div>
          <button className="btn btn--primary btn--lg" style={{ marginTop: 16 }} disabled={busy} type="submit">
            {busy ? <Spinner /> : t('pe.saveBtn')}
          </button>
        </form>

        <form className="card" style={{ padding: 16, marginTop: 12 }} onSubmit={changeEmail}>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setEmailOpen((v) => !v)}>
            {emailOpen ? t('pe.hide') : t('pe.changeEmail')}
          </button>
          {emailOpen && (
            <div>
              <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                {t('pe.currentEmail')}: <b dir="ltr">{currentEmail || '—'}</b>
              </div>
              <div className="field">
                <label>{t('pe.newEmail')}</label>
                <input className="input" dir="ltr" type="email" value={ecEmail} onChange={(e) => setEcEmail(e.target.value)} />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>{t('pe.currentPasswordConfirm')}</label>
                <input className="input" dir="ltr" type="password" value={ecPassword} onChange={(e) => setEcPassword(e.target.value)} />
              </div>
              <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>{t('pe.changeEmailHint')}</div>
              <button className="btn btn--primary btn--lg" style={{ marginTop: 12 }} disabled={emailBusy} type="submit">
                {emailBusy ? <Spinner /> : t('pe.changeEmailBtn')}
              </button>
            </div>
          )}
        </form>

        <form className="card" style={{ padding: 16, marginTop: 12 }} onSubmit={changePw}>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setPwOpen((v) => !v)}>
            {pwOpen ? t('pe.hide') : t('pe.changePassword')}
          </button>
          {pwOpen && (
            <div>
              <div className="field">
                <label>{t('pe.currentPassword')}</label>
                <input className="input" dir="ltr" type="password" value={pw.current_password} onChange={(e) => setPw((p) => ({ ...p, current_password: e.target.value }))} />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>{t('pe.newPassword')}</label>
                <input className="input" dir="ltr" type="password" value={pw.new_password} onChange={(e) => setPw((p) => ({ ...p, new_password: e.target.value }))} />
              </div>
              <button className="btn btn--primary btn--lg" style={{ marginTop: 16 }} disabled={pwBusy} type="submit">
                {pwBusy ? <Spinner /> : t('pe.changeBtn')}
              </button>
            </div>
          )}
        </form>
      </div>
      <Toast message={toast} onClose={() => setToast('')} />
    </div>
  );
}