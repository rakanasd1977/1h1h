import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useToast, fmt, PageLoading, EmptyState, Modal, Field, Confirm, Toggle, Badge, Pagination, VERIFY_STATUS } from '@rafidain/shared/ui';
import { useStaticLists } from '@rafidain/shared';
import { PageHead } from '@rafidain/shared/ui';
import { t } from '@rafidain/shared/i18n';
import { useLocale } from '@rafidain/shared';

function DocPreview({ providerId, field }: { providerId: any; field: any }) {
  const [url, setUrl] = useState<any>(null);
  const [error, setError] = useState(false);
  const [zoom, setZoom] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    fetch(`/api/providers/${providerId}/documents/${field}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error('load failed'))))
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [providerId, field]);
  if (error) return <div className="muted">{t('ad.provider.docLoadFailed')}</div>;
  if (!url) return <div className="muted">{t('ad.common.loading')}</div>;
  return (
    <>
      <img
        src={url}
        alt={t('ad.provider.docAlt')}
        className="doc-preview"
        onClick={() => setZoom(true)}
        title={t('ad.provider.docZoomHint')}
        style={{ cursor: 'zoom-in' }}
      />
      {zoom && (
        <div
          onClick={() => setZoom(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(10,10,20,0.9)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out', padding: 24,
          }}
        >
          <img src={url} alt={t('ad.provider.docAlt')} style={{ maxWidth: '96vw', maxHeight: '92vh', objectFit: 'contain', borderRadius: 8 }} onClick={(e) => e.stopPropagation()} />
          <button
            onClick={() => setZoom(false)}
            style={{ position: 'absolute', top: 16, left: 16, fontSize: 22, background: 'transparent', color: '#fff', border: 'none', cursor: 'pointer' }}
            aria-label={t('ad.provider.close')}
          >✕</button>
        </div>
      )}
    </>
  );
}

const empty = {
  name_ar: '', name_en: '', email: '', phone: '', password: '',
  governorate_id: '', service_id: '', commission_rate: 5,
  address: '', description: '', website: '', is_verified: 1,
};

export default function Providers() {
  useLocale();
  const [rows, setRows] = useState<any>(null);
  const [meta, setMeta] = useState<any>(null);
  const [page, setPage] = useState(1);
  const { governorates, services, loading: listsLoading } = useStaticLists(api);
  const [searchParams] = useSearchParams();
  const [filters, setFilters] = useState({
    service_slug: searchParams.get('service_slug') || '',
    governorate_id: searchParams.get('governorate_id') || '',
    q: searchParams.get('q') || '',
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(empty);
  const [toDelete, setToDelete] = useState<any>(null);
  const [resetPw, setResetPw] = useState<any>(null);
  const [newPw, setNewPw] = useState('');
  const [genPw, setGenPw] = useState('');
  const [saving, setSaving] = useState(false);
  const [review, setReview] = useState<any>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const toast = useToast();

  const buildQuery = (pg = page) => {
    const p = new URLSearchParams();
    if (filters.service_slug) p.set('service_slug', filters.service_slug);
    if (filters.governorate_id) p.set('governorate_id', filters.governorate_id);
    if (filters.q) p.set('q', filters.q);
    p.set('page', String(pg));
    p.set('limit', '20');
    return p.toString();
  };

  const load = (pg = page) => {
    const qs = buildQuery(pg);
    api.get(`/providers${qs ? '?' + qs : ''}`).then((r) => { setRows(r.data); setMeta(r.meta || null); }).catch((e) => toast.error(e.message));
  };

  const search = () => { setPage(1); load(1); };

  useEffect(() => { load(); }, [page]);

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const next = {
      service_slug: searchParams.get('service_slug') || '',
      governorate_id: searchParams.get('governorate_id') || '',
      q: searchParams.get('q') || '',
    };
    setFilters(next);
  }, [searchParams]);

  const openCreate = () => { setEditing(null); setForm(empty); setModalOpen(true); };
  const openEdit = (p: any) => {
    setEditing(p);
    setForm({
      name_ar: p.name_ar, name_en: p.name_en || '', email: p.email, phone: p.user_phone || '',
      password: '', governorate_id: p.governorate_id, service_id: p.service_id,
      commission_rate: p.commission_rate, address: p.address || '', description: p.description || '',
      website: p.website || '', is_verified: p.is_verified,
    });
    setModalOpen(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/providers/${editing.id}`, { ...form, password: undefined });
        toast.success(t('ad.provider.updated'));
      } else {
        const res = await api.post('/providers', form);
        if (res.data.generated_password) { setGenPw(res.data.generated_password); return; }
        toast.success(t('ad.provider.added'));
      }
      setModalOpen(false);
      load();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  const toggle = async (p: any) => {
    try {
      await api.post(`/providers/${p.id}/toggle`);
      toast.success(p.is_active ? t('ad.provider.deactivated') : t('ad.provider.activated'));
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const openReview = (p: any) => {
    setReview(p);
    setReviewNote(p.verification_note || '');
  };

  const decideReview = async (status: any) => {
    setReviewing(true);
    try {
      await api.post(`/providers/${review.id}/verify`, { status, note: reviewNote });
      toast.success(status === 'approved' ? t('ad.provider.verifyApproved') : status === 'rejected' ? t('ad.provider.verifyRejected') : t('ad.provider.verifyUpdated'));
      setReview(null);
      load();
    } catch (e: any) { toast.error(e.message); } finally { setReviewing(false); }
  };

  const doDelete = async () => {
    try {
      const res = await api.del(`/providers/${toDelete.id}`);
      toast.success(res.data.message);
      setToDelete(null);
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const doReset = async () => {
    if (!newPw || newPw.length < 6) { toast.error(t('ad.provider.pwTooShort')); return; }
    try {
      await api.post('/auth/reset-password', { user_id: resetPw.user_id, new_password: newPw });
      toast.success(t('ad.provider.pwReset'));
      setResetPw(null); setNewPw('');
    } catch (e: any) { toast.error(e.message); }
  };

  if (!rows) return <PageLoading />;

  return (
    <div>
      <PageHead title={t('ad.provider.title')} subtitle={t('ad.provider.subtitle')} actions={<><button className="btn btn-primary" onClick={openCreate}>+ {t('ad.provider.addBtn')}</button></>} />

      <div className="filters">
        <input placeholder={t('ad.provider.searchPlaceholder')} value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && search()} />
        <select value={filters.service_slug} onChange={(e) => setFilters({ ...filters, service_slug: e.target.value })}>
          <option value="">{t('ad.provider.allServices')}</option>
          {services.map((s) => <option key={s.id} value={s.slug}>{s.icon} {s.name_ar}</option>)}
        </select>
        <select value={filters.governorate_id} onChange={(e) => setFilters({ ...filters, governorate_id: e.target.value })}>
          <option value="">{t('ad.provider.allGovernorates')}</option>
          {governorates.map((g) => <option key={g.id} value={g.id}>{g.name_ar}</option>)}
        </select>
        <button className="btn btn-outline btn-sm" onClick={search}>{t('ad.common.search')}</button>
      </div>

      <div className="card">
        <div className="table-wrap">
          {rows.length === 0 ? <EmptyState text={t('ad.provider.empty')} icon="🏪" /> : (
            <table>
              <thead>
                <tr>
                  <th>{t('ad.provider.provider')}</th><th>{t('ad.svc.service')}</th><th>{t('ad.agent.gov')}</th><th>{t('ad.provider.commission')}</th>
                  <th>{t('ad.common.orders')}</th><th>{t('ad.provider.verification')}</th><th>{t('ad.common.status')}</th><th>{t('ad.common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p: any) => (
                  <tr key={p.id}>
                    <td>
                      <div className="bold">{p.name_ar}</div>
                      <div className="muted" style={{ fontSize: 12 }}>{p.email}</div>
                    </td>
                    <td><span className="badge badge-blue">{p.service_name_ar}</span></td>
                    <td><span className="badge badge-teal">{p.governorate_name_ar}</span></td>
                    <td>%{p.commission_rate}</td>
                    <td>{fmt(p.orders_count)}</td>
                    <td>
                      <Badge status={p.verification_status || (p.is_verified ? 'approved' : 'none')} map={VERIFY_STATUS} />
                      {(p.verification_status === 'pending' || (p.national_id_image || p.residency_doc_image)) && (
                        <button className="btn btn-outline btn-sm mt-1" onClick={() => openReview(p)}>{t('ad.provider.reviewBtn')}</button>
                      )}
                    </td>
                    <td><Toggle checked={!!p.is_active} onChange={() => toggle(p)} /></td>
                    <td>
                      <div className="flex wrap">
                        <button className="btn btn-outline btn-sm" onClick={() => openEdit(p)}>{t('ad.common.edit')}</button>
                        <button className="btn btn-outline btn-sm" onClick={() => setResetPw(p)}>{t('ad.provider.password')}</button>
                        <button className="btn btn-danger btn-sm" onClick={() => setToDelete(p)}>{t('ad.common.delete')}</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Pagination meta={meta} page={page} onChange={setPage} />

      <Modal open={modalOpen} title={editing ? t('ad.provider.editModal') : t('ad.provider.addModal')} onClose={() => setModalOpen(false)} size="lg">
        <div className="form-grid">
          <Field label={t('ad.gov.nameAr')} required><input value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} /></Field>
          <Field label={t('ad.gov.nameEn')}><input value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} /></Field>
          <Field label={t('ad.agent.email')} required><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label={t('ad.agent.phone')}><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          <Field label={t('ad.agent.gov')} required>
            <select value={form.governorate_id} disabled={listsLoading} onChange={(e) => setForm({ ...form, governorate_id: e.target.value })}>
              <option value="">{listsLoading ? t('ad.common.loading') : t('ad.agent.chooseGov')}</option>
              {governorates.map((g) => <option key={g.id} value={g.id}>{g.name_ar}</option>)}
            </select>
          </Field>
          <Field label={t('ad.provider.serviceType')} required>
            <select value={form.service_id} disabled={listsLoading} onChange={(e) => setForm({ ...form, service_id: e.target.value })}>
              <option value="">{listsLoading ? t('ad.common.loading') : t('ad.provider.chooseService')}</option>
              {services.map((s) => <option key={s.id} value={s.id}>{s.icon} {s.name_ar}</option>)}
            </select>
          </Field>
          <Field label={t('ad.provider.commissionRateField')}><input type="number" step="0.5" value={form.commission_rate} onChange={(e) => setForm({ ...form, commission_rate: e.target.value })} /></Field>
          {!editing && <Field label={t('ad.agent.password')} required><input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder={t('ad.agent.pwAutoGenerate')} /></Field>}
          <Field label={t('ad.provider.address')}><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
          <Field label={t('ad.provider.website')}><input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} /></Field>
          <Field label={t('ad.common.description')}><textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
        </div>
        {genPw && <div className="alert-success mt-3">{t('ad.provider.addedPwNote')}: <strong className="mono">{genPw}</strong></div>}
        <div className="form-actions">
          <button className="btn btn-outline" onClick={() => setModalOpen(false)}>{t('ad.common.cancel')}</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? t('ad.common.saving') : t('ad.common.save')}</button>
        </div>
      </Modal>

      <Modal open={!!review} title={`${t('ad.provider.reviewTitle')} - ${review?.name_ar || ''}`} onClose={() => setReview(null)} size="lg">
        {review && (
          <>
            <div className="alert-info mb-3">
              {t('ad.provider.currentStatus')}: <Badge status={review.verification_status || (review.is_verified ? 'approved' : 'none')} map={VERIFY_STATUS} />
              {review.submitted_at && <span className="muted"> — {t('ad.provider.submittedAt', { date: fmt(review.submitted_at) })}</span>}
            </div>
            <div className="form-grid">
              <Field label={t('ad.provider.nationalId')}>
                {review.national_id_image ? (
                  <DocPreview providerId={review.id} field="national_id" />
                ) : <div className="muted">{t('ad.provider.notUploaded')}</div>}
              </Field>
              <Field label={t('ad.provider.residencyDoc')}>
                {review.residency_doc_image ? (
                  <DocPreview providerId={review.id} field="residency" />
                ) : <div className="muted">{t('ad.provider.notUploaded')}</div>}
              </Field>
            </div>
            <Field label={t('ad.provider.reviewNote')}><textarea rows={2} value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} placeholder={t('ad.provider.reviewNotePlaceholder')} /></Field>
            <div className="flex gap-sm mt-3">
              <button className="btn btn-success" disabled={reviewing} onClick={() => decideReview('approved')}>✓ {t('ad.provider.approveBtn')}</button>
              <button className="btn btn-danger" disabled={reviewing} onClick={() => decideReview('rejected')}>✕ {t('ad.provider.rejectBtn')}</button>
              <button className="btn btn-outline" disabled={reviewing} onClick={() => decideReview('none')}>{t('ad.provider.cancelVerifyBtn')}</button>
              <button className="btn btn-outline" onClick={() => setReview(null)}>{t('ad.common.close')}</button>
            </div>
          </>
        )}
      </Modal>

      <Modal open={!!resetPw} title={`${t('ad.provider.resetPwTitle')} - ${resetPw?.name_ar || ''}`} onClose={() => setResetPw(null)}>
        <Field label={t('ad.provider.newPw')} required><input type="text" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder={t('ad.provider.pw6chars')} /></Field>
        <div className="form-actions">
          <button className="btn btn-outline" onClick={() => setResetPw(null)}>{t('ad.common.cancel')}</button>
          <button className="btn btn-primary" onClick={doReset}>{t('ad.provider.resetPwBtn')}</button>
        </div>
      </Modal>

      <Confirm open={!!toDelete} title={t('ad.provider.deleteTitle')} message={t('ad.provider.deleteMsg', { name: toDelete?.name_ar })} danger onConfirm={doDelete} onCancel={() => setToDelete(null)} />
    </div>
  );
}
