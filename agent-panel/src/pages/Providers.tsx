import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useToast, fmt, PageLoading, EmptyState, Modal, Field, Confirm, Toggle, Badge, Pagination, VERIFY_STATUS } from '@rafidain/shared/ui';
import type { ProviderRow } from '../types';
import { PageHead } from '@rafidain/shared/ui';
import { t } from '@rafidain/shared/i18n';
import { useLocale } from '@rafidain/shared';

function RatingCell({ p }: { p: ProviderRow }) {
  if (!p.rating_count) return <span className="muted">—</span>;
  const low = p.rating_count > 0 && Number(p.rating) < 3;
  return (
    <span>
      <span className="rating-stars">{'★'.repeat(Math.round(Number(p.rating) || 0))}{'☆'.repeat(5 - Math.round(Number(p.rating) || 0))}</span>
      <div>
        <span className={low ? 'rating-low' : 'bold'}>{Number(p.rating).toFixed(1)}</span>
        <span className="rating-num"> ({fmt(p.rating_count)})</span>
        {low && <span className="badge badge-red" style={{ marginInlineStart: 4 }}>{t('ag.providers.lowRating')}</span>}
      </div>
    </span>
  );
}

function DocPreview({ providerId, field }: { providerId: number | string; field: string }) {
  const [url, setUrl] = useState<string | null>(null);
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
  if (error) return <div className="muted">{t('ag.providers.docLoadError')}</div>;
  if (!url) return <div className="muted">{t('ag.providers.docLoading')}</div>;
  return (
    <>
      <img
        src={url}
        alt={t('ag.providers.docAlt')}
        className="doc-preview"
        onClick={() => setZoom(true)}
        title={t('ag.providers.docZoomHint')}
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
          <img src={url} alt={t('ag.providers.docAlt')} style={{ maxWidth: '96vw', maxHeight: '92vh', objectFit: 'contain', borderRadius: 8 }} onClick={(e) => e.stopPropagation()} />
          <button
            onClick={() => setZoom(false)}
            style={{ position: 'absolute', top: 16, left: 16, fontSize: 22, background: 'transparent', color: '#fff', border: 'none', cursor: 'pointer' }}
            aria-label={t('ag.providers.docClose')}
          >✕</button>
        </div>
      )}
    </>
  );
}

const empty = {
  name_ar: '', name_en: '', email: '', phone: '', password: '',
  service_id: '', commission_rate: 5, address: '', description: '', website: '', is_verified: 1,
};

export default function Providers() {
  useLocale();
  const [rows, setRows] = useState<ProviderRow[] | null>(null);
  const [meta, setMeta] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [services, setServices] = useState<any[]>([]);
  const [filters, setFilters] = useState({ service_slug: '', q: '', sort: '' });
  const [modalOpen, setModalOpen] = useState(false);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [sendingB, setSendingB] = useState(false);
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
  const navigate = useNavigate();

  const SORT_OPTIONS = [
    { value: '', label: t('ag.providers.sortDefault') },
    { value: 'rating', label: t('ag.providers.sortRating') },
    { value: 'orders', label: t('ag.providers.sortOrders') },
    { value: 'value', label: t('ag.providers.sortValue') },
    { value: 'name', label: t('ag.providers.sortName') },
  ];

  const buildQuery = (pg = page) => {
    const p = new URLSearchParams();
    if (filters.service_slug) p.set('service_slug', filters.service_slug);
    if (filters.q) p.set('q', filters.q);
    if (filters.sort) p.set('sort', filters.sort);
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
    api.get('/services').then((r) => setServices(r.data)).catch(() => {});
    load();
  }, []);

  const openCreate = () => { setEditing(null); setForm(empty); setModalOpen(true); };
  const openEdit = (p: ProviderRow) => {
    setEditing(p);
    setForm({
      name_ar: p.name_ar, name_en: p.name_en || '', email: p.email, phone: p.user_phone || '',
      password: '', service_id: p.service_id, commission_rate: p.commission_rate,
      address: p.address || '', description: p.description || '', website: p.website || '', is_verified: p.is_verified,
    });
    setModalOpen(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/providers/${editing.id}`, { ...form, password: undefined });
        toast.success(t('ag.providers.updatedToast'));
      } else {
        const res = await api.post('/providers', form);
        if (res.data.generated_password) { setGenPw(res.data.generated_password); return; }
        toast.success(t('ag.providers.addedToast'));
      }
      setModalOpen(false);
      load();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  const toggle = async (p: ProviderRow) => {
    try {
      await api.post(`/providers/${p.id}/toggle`);
      toast.success(p.is_active ? t('ag.providers.deactivatedToast') : t('ag.providers.activatedToast'));
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  const openReview = (p: ProviderRow) => {
    setReview(p);
    setReviewNote(p.verification_note || '');
  };

  const decideReview = async (status: string) => {
    setReviewing(true);
    try {
      await api.post(`/providers/${review.id}/verify`, { status, note: reviewNote });
      toast.success(status === 'approved' ? t('ag.providers.verifiedToast') : status === 'rejected' ? t('ag.providers.rejectedToast') : t('ag.providers.verificationUpdatedToast'));
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
    if (!newPw || newPw.length < 6) { toast.error(t('ag.providers.pwMinError')); return; }
    try {
      await api.post('/auth/reset-password', { user_id: resetPw.user_id, new_password: newPw });
      toast.success(t('ag.providers.pwResetToast'));
      setResetPw(null); setNewPw('');
    } catch (e: any) { toast.error(e.message); }
  };

  const sendBroadcast = async () => {
    if (!broadcastMsg.trim()) { toast.error(t('ag.providers.broadcastEmptyError')); return; }
    setSendingB(true);
    try {
      const res = await api.post('/agent/providers/broadcast', { message: broadcastMsg.trim() });
      toast.success(res.data.message);
      setBroadcastOpen(false);
      setBroadcastMsg('');
    } catch (e: any) { toast.error(e.message); } finally { setSendingB(false); }
  };

  if (!rows) return <PageLoading />;

  return (
    <div>
      <PageHead title={t('ag.providers.title')} subtitle={t('ag.providers.subtitle')} actions={<><div className="flex wrap">
          <button className="btn btn-outline" onClick={() => setBroadcastOpen(true)}>{t('ag.providers.broadcastBtn')}</button>
          <button className="btn btn-primary" onClick={openCreate}>{t('ag.providers.addBtn')}</button></div></>} />

      <div className="filters">
        <input placeholder={t('ag.providers.searchPlaceholder')} value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && search()} />
        <select value={filters.service_slug} onChange={(e) => setFilters({ ...filters, service_slug: e.target.value })}>
          <option value="">{t('ag.providers.allServices')}</option>
          {services.map((s) => <option key={s.id} value={s.slug}>{s.icon} {s.name_ar}</option>)}
        </select>
        <select value={filters.sort} onChange={(e) => setFilters({ ...filters, sort: e.target.value })}>
          {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <button className="btn btn-outline btn-sm" onClick={search}>{t('ag.providers.searchBtn')}</button>
      </div>

      <div className="card">
        <div className="table-wrap">
          {rows.length === 0 ? <EmptyState text={t('ag.providers.emptyText')} icon="🏪" /> : (
            <table>
              <thead>
                <tr>
                  <th>{t('ag.providers.th.provider')}</th><th>{t('ag.providers.th.service')}</th><th>{t('ag.providers.th.rating')}</th><th>{t('ag.providers.th.commission')}</th><th>{t('ag.providers.th.orders')}</th><th>{t('ag.providers.th.verification')}</th><th>{t('ag.providers.th.active')}</th><th>{t('ag.providers.th.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div className="bold">{p.name_ar}</div>
                      <div className="muted" style={{ fontSize: 12 }}>{p.email}</div>
                    </td>
                    <td><span className="badge badge-blue">{p.service_name_ar}</span></td>
                    <td><RatingCell p={p} /></td>
                    <td>%{p.commission_rate}</td>
                    <td>{fmt(p.orders_count)}</td>
                    <td>
                      <Badge status={p.verification_status || (p.is_verified ? 'approved' : 'none')} map={VERIFY_STATUS} />
                      {(p.verification_status === 'pending' || (p.national_id_image || p.residency_doc_image)) && (
                        <button className="btn btn-outline btn-sm mt-1" onClick={() => openReview(p)}>{t('ag.providers.reviewBtn')}</button>
                      )}
                    </td>
                    <td><Toggle checked={!!p.is_active} onChange={() => toggle(p)} /></td>
                    <td>
                      <div className="flex wrap">
                        <button className="btn btn-outline btn-sm" onClick={() => navigate(`/providers/${p.id}`)}>{t('ag.providers.viewBtn')}</button>
                        <button className="btn btn-outline btn-sm" onClick={() => openEdit(p)}>{t('ag.providers.editBtn')}</button>
                        <button className="btn btn-outline btn-sm" onClick={() => setResetPw(p)}>{t('ag.providers.passwordBtn')}</button>
                        <button className="btn btn-danger btn-sm" onClick={() => setToDelete(p)}>{t('ag.providers.deleteBtn')}</button>
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

      <Modal open={modalOpen} title={editing ? t('ag.providers.modalEdit') : t('ag.providers.modalAdd')} onClose={() => setModalOpen(false)} size="lg">
        <div className="alert-info">{t('ag.providers.autoAdded', { name: rows?.[0]?.governorate_name_ar || '' })}</div>
        <div className="form-grid">
          <Field label={t('ag.providers.fieldNameAr')} required><input value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} /></Field>
          <Field label={t('ag.providers.fieldNameEn')}><input value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} /></Field>
          <Field label={t('ag.providers.fieldEmail')} required><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label={t('ag.providers.fieldPhone')}><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          <Field label={t('ag.providers.fieldServiceType')} required>
            <select value={form.service_id} onChange={(e) => setForm({ ...form, service_id: e.target.value })}>
              <option value="">{t('ag.providers.chooseService')}</option>
              {services.map((s) => <option key={s.id} value={s.id}>{s.icon} {s.name_ar}</option>)}
            </select>
          </Field>
          <Field label={t('ag.providers.fieldCommission')}><input type="number" step="0.5" value={form.commission_rate} onChange={(e) => setForm({ ...form, commission_rate: e.target.value })} /></Field>
          {!editing && <Field label={t('ag.providers.fieldPassword')} required><input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder={t('ag.providers.autoGenPw')} /></Field>}
          <Field label={t('ag.providers.fieldAddress')}><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
          <Field label={t('ag.providers.fieldWebsite')}><input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} /></Field>
          <Field label={t('ag.providers.fieldDesc')}><textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
        </div>
        {genPw && <div className="alert-success mt-3">{t('ag.providers.addedTempPw', { pw: genPw })}</div>}
        <div className="form-actions">
          <button className="btn btn-outline" onClick={() => setModalOpen(false)}>{t('ag.providers.cancel')}</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? t('ag.providers.saving') : t('ag.providers.save')}</button>
        </div>
      </Modal>

      <Modal open={!!review} title={t('ag.providers.reviewTitle', { name: review?.name_ar || '' })} onClose={() => setReview(null)} size="lg">
        {review && (
          <>
            <div className="alert-info mb-3">
              {t('ag.providers.currentStatus')} <Badge status={review.verification_status || (review.is_verified ? 'approved' : 'none')} map={VERIFY_STATUS} />
              {review.submitted_at && <span className="muted"> — {t('ag.providers.submittedAt', { date: fmt(review.submitted_at) })}</span>}
            </div>
            <div className="form-grid">
              <Field label={t('ag.providers.nationalId')}>
                {review.national_id_image ? (
                  <DocPreview providerId={review.id} field="national_id" />
                ) : <div className="muted">{t('ag.providers.notUploaded')}</div>}
              </Field>
              <Field label={t('ag.providers.residency')}>
                {review.residency_doc_image ? (
                  <DocPreview providerId={review.id} field="residency" />
                ) : <div className="muted">{t('ag.providers.notUploadedResidency')}</div>}
              </Field>
            </div>
            <Field label={t('ag.providers.reviewNote')}><textarea rows={2} value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} placeholder={t('ag.providers.reviewNotePlaceholder')} /></Field>
            <div className="flex gap-sm mt-3">
              <button className="btn btn-success" disabled={reviewing} onClick={() => decideReview('approved')}>{t('ag.providers.approveBtn')}</button>
              <button className="btn btn-danger" disabled={reviewing} onClick={() => decideReview('rejected')}>{t('ag.providers.rejectBtn')}</button>
              <button className="btn btn-outline" disabled={reviewing} onClick={() => decideReview('none')}>{t('ag.providers.cancelVerifyBtn')}</button>
              <button className="btn btn-outline" onClick={() => setReview(null)}>{t('ag.providers.closeBtn')}</button>
            </div>
          </>
        )}
      </Modal>

      <Modal open={!!resetPw} title={t('ag.providers.resetTitle', { name: resetPw?.name_ar || '' })} onClose={() => setResetPw(null)}>
        <Field label={t('ag.providers.resetPwNew')} required><input type="text" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder={t('ag.providers.resetPwPlaceholder')} /></Field>
        <div className="form-actions">
          <button className="btn btn-outline" onClick={() => setResetPw(null)}>{t('ag.providers.cancel')}</button>
          <button className="btn btn-primary" onClick={doReset}>{t('ag.providers.resetBtn')}</button>
        </div>
      </Modal>

      <Confirm open={!!toDelete} title={t('ag.providers.deleteTitle')} message={t('ag.providers.deleteMsg', { name: toDelete?.name_ar || '' })} danger onConfirm={doDelete} onCancel={() => setToDelete(null)} />

      <Modal open={broadcastOpen} title={t('ag.providers.broadcastTitle')} onClose={() => setBroadcastOpen(false)}>
        <div className="alert-info mb-3">{t('ag.providers.broadcastHint')}</div>
        <Field label={t('ag.providers.msgLabel')} required hint={t('ag.providers.msgHint', { remaining: 600 - broadcastMsg.length })}>
          <textarea rows={4} value={broadcastMsg} onChange={(e) => setBroadcastMsg(e.target.value.slice(0, 600))} placeholder={t('ag.providers.msgPlaceholder')} />
        </Field>
        <div className="form-actions">
          <button className="btn btn-outline" onClick={() => setBroadcastOpen(false)}>{t('ag.providers.cancel')}</button>
          <button className="btn btn-primary" onClick={sendBroadcast} disabled={sendingB}>{sendingB ? t('ag.providers.sending') : t('ag.providers.sendBtn')}</button>
        </div>
      </Modal>
    </div>
  );
}
