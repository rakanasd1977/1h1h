import { useEffect, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { Toast } from '../components/Toast';
import { CenterSpinner } from '../components/Spinner';
import { customerApi, publicApi } from '../api';
import { useLocale, t } from '@rafidain/shared';

const emptyForm = { label: '', name_ar: '', phone: '', governorate_id: '', address: '' };

export default function Addresses() {
  useLocale();
  const [list, setList] = useState<any>(null);
  const [govs, setGovs] = useState<any[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');

  const refresh = () => customerApi.addresses().then(setList).catch(() => setList([]));

  useEffect(() => {
    refresh();
    publicApi.governorates().then((rows) => setGovs(rows || [])).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (a: any) => {
    setEditingId(a.id);
    setForm({
      label: a.label || '',
      name_ar: a.name_ar || '',
      phone: a.phone || '',
      governorate_id: a.governorate_id || '',
      address: a.address || '',
    });
    setOpen(true);
  };

  const submit = async () => {
    if (!form.address.trim()) {
      setToast(t('addr.required'));
      return;
    }
    setBusy(true);
    setToast('');
    try {
      const body = {
        label: form.label || undefined,
        name_ar: form.name_ar || undefined,
        phone: form.phone || undefined,
        governorate_id: form.governorate_id ? Number(form.governorate_id) : undefined,
        address: form.address.trim(),
      };
      if (editingId) {
        await customerApi.updateAddress(editingId, body);
        setToast(t('addr.updatedToast'));
      } else {
        await customerApi.addAddress(body);
        setToast(t('addr.addedToast'));
      }
      setOpen(false);
      await refresh();
    } catch (e: any) {
      setToast(e.message);
    } finally {
      setBusy(false);
    }
  };

  const setDefault = async (a: any) => {
    try {
      await customerApi.setDefaultAddress(a.id);
      await refresh();
    } catch (e: any) {
      setToast(e.message);
    }
  };

  const remove = async (a: any) => {
    if (!window.confirm(t('addr.deleteConfirm', { name: a.label || a.address }))) return;
    try {
      await customerApi.deleteAddress(a.id);
      setToast(t('addr.deletedToast'));
      await refresh();
    } catch (e: any) {
      setToast(e.message);
    }
  };

  return (
    <div>
      <PageHeader title={t('addr.title')} right={
        <button className="iconbtn iconbtn--light" onClick={openAdd} type="button" aria-label={t('addr.addAria')}>＋</button>
      } />
      <div className="page page--no-nav">
        {!list ? (
          <CenterSpinner />
        ) : list.length === 0 ? (
          <div className="empty">
            <div className="empty__icon">📍</div>
            <div className="empty__title">{t('addr.emptyTitle')}</div>
            <div className="empty__sub">{t('addr.emptySub')}</div>
            <button className="btn btn--primary" onClick={openAdd} type="button">{t('addr.addBtn')}</button>
          </div>
        ) : (
          list.map((a: any) => (
            <div className="card" key={a.id} style={{ padding: 14, marginBottom: 12 }}>
              <div className="row row--between">
                <span style={{ fontWeight: 800, fontSize: 15 }}>
                  {a.label || t('addr.defaultLabel')}{a.is_default ? <span style={{ fontSize: 11, color: '#00a650' }}>{t('addr.isDefault')}</span> : null}
                </span>
                <div className="row" style={{ gap: 4 }}>
                  <button className="chip" onClick={() => openEdit(a)} type="button">{t('addr.edit')}</button>
                  <button className="chip" onClick={() => remove(a)} type="button" style={{ color: '#ff3b30' }}>{t('cart.remove')}</button>
                </div>
              </div>
              {a.name_ar || a.phone ? (
                <div className="muted" style={{ marginTop: 6 }}>
                  {a.name_ar ? `${a.name_ar}` : ''}{a.phone ? ` — ${a.phone}` : ''}
                </div>
              ) : null}
              <div style={{ marginTop: 4, fontSize: 13, lineHeight: 1.6 }}>
                {a.address}{a.governorate_name_ar ? `، ${a.governorate_name_ar}` : ''}
              </div>
              {!a.is_default && (
                <button className="btn btn--outline btn--sm" style={{ marginTop: 10 }} onClick={() => setDefault(a)} type="button">
                  {t('addr.setDefault')}
                </button>
              )}
            </div>
          ))
        )}

        {open && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 90, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
            <div className="card" style={{ width: '100%', maxWidth: 520, maxHeight: '88vh', overflowY: 'auto', padding: 16, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}>
              <div className="row row--between" style={{ marginBottom: 14 }}>
                <span style={{ fontWeight: 800, fontSize: 16 }}>{editingId ? t('addr.editTitle') : t('addr.addTitle')}</span>
                <button className="iconbtn" onClick={() => setOpen(false)} type="button" aria-label={t('addr.closeAria')}>✕</button>
              </div>
              <div className="field">
                <label>{t('addr.labelField')}</label>
                <input className="input" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
              </div>
              <div className="field">
                <label>{t('addr.nameField')}</label>
                <input className="input" value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} />
              </div>
              <div className="field">
                <label>{t('addr.phoneField')}</label>
                <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="field">
                <label>{t('addr.govField')}</label>
                <select className="input" value={form.governorate_id} onChange={(e) => setForm({ ...form, governorate_id: e.target.value })}>
                  <option value="">{t('addr.chooseGov')}</option>
                  {govs.map((g) => <option key={g.id} value={g.id}>{g.name || g.name_ar}</option>)}
                </select>
              </div>
              <div className="field">
                <label>{t('addr.addressField')}</label>
                <textarea className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder={t('addr.addressPlaceholder')} />
              </div>
              <button className="btn btn--primary" onClick={submit} disabled={busy} type="button">
                {busy ? '...' : editingId ? t('addr.saveEdit') : t('addr.submit')}
              </button>
            </div>
          </div>
        )}
      </div>
      <Toast message={toast} onClose={() => setToast('')} />
    </div>
  );
}
