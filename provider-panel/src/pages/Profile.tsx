import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { useToast, PageLoading, Badge, Field, Modal } from '@rafidain/shared/ui';
import ImageUpload from '../components/ImageUpload';
import { PageHead } from '@rafidain/shared/ui';
import { t } from '@rafidain/shared/i18n';
import { useLocale } from '@rafidain/shared';

export default function Profile() {
  const { user } = useAuth();
  const toast = useToast();
  const [p, setP] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [pw, setPw] = useState({ password: '', confirm: '' });
  const [pwSaving, setPwSaving] = useState(false);
  useLocale();

  useEffect(() => {
    api.get('/provider/profile').then((r) => setP(r.data)).catch((e) => toast.error(e.message));
  }, []);

  const openEdit = () => {
    setForm({
      name_ar: p.name_ar,
      name_en: p.name_en,
      phone: p.phone || '',
      address: p.address || '',
      bio: p.bio || '',
      bank_account_holder: p.bank_account_holder || '',
      bank_iban: p.bank_iban || '',
      bank_name: p.bank_name || '',
      logo_url: p.logo_url || '',
      cover_url: p.cover_url || '',
      sub_categories: p.sub_categories || [],
    });
    setEditing(true);
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      const res = await api.put('/provider/profile', form);
      setP(res.data);
      setEditing(false);
      toast.success(t('pr.profile.updatedToast'));
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  const changePw = async () => {
    if (pw.password.length < 8) { toast.error(t('pr.profile.pwMinLength')); return; }
    if (pw.password !== pw.confirm) { toast.error(t('pr.profile.pwMismatch')); return; }
    setPwSaving(true);
    try {
      await api.put('/provider/profile', { password: pw.password });
      toast.success(t('pr.profile.pwUpdated'));
      setPw({ password: '', confirm: '' });
    } catch (e: any) { toast.error(e.message); } finally { setPwSaving(false); }
  };

  if (!p) return <PageLoading />;

  return (
    <div>
      <PageHead title={t('pr.profile.pageTitle')} subtitle={t('pr.profile.pageSubtitle')} actions={<button className="btn btn-outline" onClick={openEdit}>{t('pr.profile.editBtn')}</button>} />

      <div className="card mb-4">
        <div className="card-body">
          <div className="detail-grid">
            <div className="detail-item"><div className="k">{t('pr.profile.labelName')}</div><div className="v">{p.name_ar}<div className="muted">{p.name_en}</div></div></div>
            <div className="detail-item"><div className="k">{t('pr.profile.labelPhone')}</div><div className="v">{p.phone || '-'}</div></div>
            <div className="detail-item"><div className="k">{t('pr.profile.labelEmail')}</div><div className="v">{p.email}</div></div>
            <div className="detail-item"><div className="k">{t('pr.profile.labelGov')}</div><div className="v"><span className="badge badge-teal">{p.governorate_name_ar}</span></div></div>
            <div className="detail-item"><div className="k">{t('pr.profile.labelAddress')}</div><div className="v">{p.address || '-'}</div></div>
            <div className="detail-item"><div className="k">{t('pr.profile.labelBio')}</div><div className="v">{p.bio || '-'}</div></div>
            <div className="detail-item"><div className="k">{t('pr.profile.labelCategory')}</div><div className="v"><span className="badge badge-blue">{p.category_name_ar || '-'}</span></div></div>
            <div className="detail-item"><div className="k">{t('pr.profile.labelRating')}</div><div className="v">{p.rating} / 5 ({p.rating_count})</div></div>
            <div className="detail-item" style={{ gridColumn: '1 / -1' }}><div className="k">{t('pr.profile.labelLogo')}</div><div className="v">{p.logo_url ? <img src={p.logo_url} alt="" style={{ height: 40, borderRadius: 8 }} /> : '-'}</div></div>
            <div className="detail-item" style={{ gridColumn: '1 / -1' }}><div className="k">{t('pr.profile.labelCover')}</div><div className="v">{p.cover_url ? <img src={p.cover_url} alt="" style={{ height: 80, borderRadius: 8, width: '100%', objectFit: 'cover' }} /> : '-'}</div></div>
          </div>
        </div>
      </div>

      <div className="card mb-4">
        <div className="card-header"><h3>{t('pr.profile.verificationTitle')}</h3></div>
        <div className="card-body">
          <div className="detail-grid">
            <div className="detail-item"><div className="k">{t('pr.profile.statusLabel')}</div><div className="v"><Badge status={p.is_verified ? 'verified' : 'pending'} map={{ verified: { label: t('pr.profile.verifiedBadge'), cls: 'badge-green' }, pending: { label: t('pr.profile.pendingBadge'), cls: 'badge-amber' } }} /></div></div>
            <div className="detail-item"><div className="k">{t('pr.profile.ownerLabel')}</div><div className="v">{p.owner_name || '-'}</div></div>
            <div className="detail-item"><div className="k">{t('pr.profile.nationalLabel')}</div><div className="v">{p.national_id || '-'}</div></div>
            <div className="detail-item"><div className="k">{t('pr.profile.bankLabel')}</div><div className="v">{p.bank_account_holder || '-'}</div></div>
          </div>
          {!p.is_verified && <p className="muted" style={{ marginTop: 8 }}>{t('pr.profile.verifyHint')}</p>}
        </div>
      </div>

      <div className="card mb-4">
        <div className="card-header"><h3>{t('pr.profile.pwTitle')}</h3></div>
        <div className="card-body">
          <div className="grid grid-2" style={{ maxWidth: 480 }}>
            <Field label={t('pr.profile.pwLabel')}>
              <input type="password" value={pw.password} onChange={(e) => setPw({ ...pw, password: e.target.value })} />
            </Field>
            <Field label={t('pr.profile.pwConfirmLabel')}>
              <input type="password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
            </Field>
          </div>
          <div style={{ marginTop: 8 }}>
            <button className="btn btn-outline" onClick={changePw} disabled={pwSaving}>{pwSaving ? t('pr.profile.pwSaving') : t('pr.profile.pwChangeBtn')}</button>
          </div>
        </div>
      </div>

      <Modal open={editing} title={t('pr.profile.editTitle')} onClose={() => setEditing(false)} size="lg">
        <div className="grid grid-2">
          <Field label={t('pr.profile.editNameAr')} required><input value={form.name_ar || ''} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} /></Field>
          <Field label={t('pr.profile.editNameEn')}><input value={form.name_en || ''} onChange={(e) => setForm({ ...form, name_en: e.target.value })} /></Field>
          <Field label={t('pr.profile.editPhone')}><input value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          <Field label={t('pr.profile.editAddress')}><input value={form.address || ''} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
          <Field label={t('pr.profile.editBio')} full><textarea value={form.bio || ''} onChange={(e) => setForm({ ...form, bio: e.target.value })} rows={3} /></Field>
          <Field label={t('pr.profile.editLogo')} full><ImageUpload value={form.logo_url} onChange={(v) => setForm({ ...form, logo_url: v })} /></Field>
          <Field label={t('pr.profile.editCover')} full><ImageUpload value={form.cover_url} onChange={(v) => setForm({ ...form, cover_url: v })} /></Field>
          <Field label={t('pr.profile.editBankHolder')}><input value={form.bank_account_holder || ''} onChange={(e) => setForm({ ...form, bank_account_holder: e.target.value })} /></Field>
          <Field label={t('pr.profile.editIban')}><input value={form.bank_iban || ''} onChange={(e) => setForm({ ...form, bank_iban: e.target.value })} /></Field>
          <Field label={t('pr.profile.editBankName')}><input value={form.bank_name || ''} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} /></Field>
        </div>
        <div className="flex gap-sm" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="btn btn-outline" onClick={() => setEditing(false)}>{t('pr.profile.cancelEdit')}</button>
          <button className="btn btn-primary" onClick={saveProfile} disabled={saving}>{saving ? t('pr.profile.savingEdit') : t('pr.profile.saveEdit')}</button>
        </div>
      </Modal>
    </div>
  );
}

