import { useEffect, useState } from 'react';
import { api } from '../api';
import { useToast, fmt, fmtDate, PageLoading, EmptyState, StatCard, Badge, Field, Modal, Confirm, Pagination, Toggle } from '@rafidain/shared/ui';
import { PageHead } from '@rafidain/shared/ui';
import { t } from '@rafidain/shared/i18n';
import { useLocale } from '@rafidain/shared';

const STATUS_MAP = {
  active: { label: 'pr.coupons.activeBadge', cls: 'badge-green' },
  inactive: { label: 'pr.coupons.inactiveBadge', cls: 'badge-gray' },
  expired: { label: 'pr.coupons.expiredBadge', cls: 'badge-gray' },
  exhausted: { label: 'pr.coupons.exhaustedBadge', cls: 'badge-amber' },
};

const EMPTY_FORM = {
  code: '',
  title: '',
  discount_type: 'percent',
  discount_value: '',
  min_amount: '',
  starts_at: '',
  ends_at: '',
  max_uses: '',
  per_customer_limit: '',
  is_active: true,
};

const toDateInput = (v?: string | null) => (v ? String(v).slice(0, 10) : '');

export default function Coupons() {
  const [rows, setRows] = useState<any>(null);
  const [meta, setMeta] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState<any>(null);
  const toast = useToast();
  useLocale();

  const load = (pg = page) => {
    const p = new URLSearchParams();
    p.set('page', String(pg));
    p.set('limit', '50');
    api.get(`/provider/coupons?${p.toString()}`).then((r) => { setRows(r.data); setMeta(r.meta || null); }).catch((e) => toast.error(e.message));
  };
  useEffect(() => { load(); }, [page]);

  const openAdd = () => {
    setEditing({ id: null });
    setForm(EMPTY_FORM);
  };

  const openEdit = (c: any) => {
    setEditing({ id: c.id });
    setForm({
      code: c.code,
      title: c.title || '',
      discount_type: c.discount_type === 'fixed' ? 'fixed' : 'percent',
      discount_value: c.discount_value,
      min_amount: c.min_amount || '',
      starts_at: toDateInput(c.starts_at),
      ends_at: toDateInput(c.ends_at),
      max_uses: c.max_uses || '',
      per_customer_limit: c.per_customer_limit || '',
      is_active: Number(c.is_active) === 1,
    });
  };

  const save = async () => {
    if (!form.code.trim()) { toast.error(t('pr.coupons.codeError')); return; }
    if (!form.discount_value || Number(form.discount_value) <= 0) { toast.error(t('pr.coupons.discountError')); return; }
    if (form.discount_type === 'percent' && Number(form.discount_value) > 100) { toast.error(t('pr.coupons.discountMaxError')); return; }
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        code: form.code.trim().toUpperCase(),
        discount_type: form.discount_type,
        discount_value: Number(form.discount_value),
        min_amount: form.min_amount ? Number(form.min_amount) : 0,
        starts_at: form.starts_at || undefined,
        ends_at: form.ends_at || undefined,
        max_uses: form.max_uses ? Number(form.max_uses) : 0,
        per_customer_limit: form.per_customer_limit ? Number(form.per_customer_limit) : 1,
        is_active: form.is_active ? 1 : 0,
      };
      if (form.title.trim()) payload.title = form.title.trim();
      if (editing.id) {
        await api.put(`/provider/coupons/${editing.id}`, payload);
        toast.success(t('pr.coupons.updatedToast'));
      } else {
        await api.post('/provider/coupons', payload);
        toast.success(t('pr.coupons.createdToast'));
      }
      setEditing(null);
      load();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  const toggle = async (c: any) => {
    setSaving(true);
    try {
      await api.post(`/provider/coupons/${c.id}/toggle`);
      toast.success(Number(c.is_active) === 1 ? t('pr.coupons.toggleOffToast') : t('pr.coupons.toggleOnToast'));
      load();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  const deleteCoupon = async () => {
    if (!confirmDel) return;
    setSaving(true);
    try {
      await api.del(`/provider/coupons/${confirmDel.id}`);
      toast.success(t('pr.coupons.deletedToast'));
      setConfirmDel(null);
      load();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  if (!rows) return <PageLoading />;

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div>
      <PageHead title={t('pr.coupons.title')} subtitle={t('pr.coupons.subtitle')} actions={<button className="btn btn-primary" onClick={openAdd}>{t('pr.coupons.createBtn')}</button>} />

      <div className="grid grid-3 mb-4">
        <StatCard label={t('pr.coupons.totalLabel')} value={String(meta?.total ?? 0)} icon="🎟️" tone="primary" />
        <StatCard label={t('pr.coupons.activeLabel')} value={String(meta?.active_count ?? 0)} icon="✅" tone="success" />
        <StatCard label={t('pr.coupons.usesLabel')} value={String(meta?.used_total ?? 0)} icon="📊" tone="info" />
      </div>

      <div className="card">
        <div className="table-wrap">
          {rows.length === 0 ? <EmptyState text={t('pr.coupons.empty')} icon="🎟️" /> : (
            <table>
              <thead><tr><th>{t('pr.coupons.thCode')}</th><th>{t('pr.coupons.thTitle')}</th><th>{t('pr.coupons.thDiscount')}</th><th>{t('pr.coupons.thMinAmount')}</th><th>{t('pr.coupons.thExpiry')}</th><th>{t('pr.coupons.thUsage')}</th><th>{t('pr.coupons.thStatus')}</th><th>{t('pr.coupons.thActions')}</th></tr></thead>
              <tbody>
                {rows.map((c: any) => (
                  <tr key={c.id}>
                    <td className="mono">{c.code}</td>
                    <td>{c.title || '-'}</td>
                    <td className="bold">{c.discount_type === 'percent' ? `${c.discount_value}%` : fmt(c.discount_value)}</td>
                    <td>{Number(c.min_amount) > 0 ? fmt(c.min_amount) : t('pr.coupons.noMin')}</td>
                    <td className="muted">{c.ends_at ? fmtDate(c.ends_at) : t('pr.coupons.noExpiry')}</td>
                    <td>{c.used_count || 0}{Number(c.max_uses) > 0 ? ` / ${c.max_uses}` : ''}</td>
                    <td><Badge status={c.status} map={STATUS_MAP} /></td>
                    <td>
                      <div className="flex gap-sm">
                        <button className="btn btn-outline btn-sm" onClick={() => openEdit(c)}>{t('pr.coupons.editBtn')}</button>
                        <button className="btn btn-outline btn-sm" onClick={() => toggle(c)}>{Number(c.is_active) === 1 ? t('pr.coupons.deactivateBtn') : t('pr.coupons.activateBtn')}</button>
                        <button className="btn btn-outline btn-sm btn-danger-ghost" onClick={() => setConfirmDel(c)}>{t('pr.coupons.deleteBtn')}</button>
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

      <Modal open={!!editing} title={editing?.id ? t('pr.coupons.editTitle') : t('pr.coupons.createTitle')} onClose={() => setEditing(null)} size="md">
        <p className="muted mb-4">{t('pr.coupons.formHint')}</p>
        <div className="form-grid">
          <Field label={t('pr.coupons.fieldCode')} required>
            <input value={form.code} onChange={(e) => set('code', e.target.value.toUpperCase())} placeholder={t('pr.coupons.codeHint')} style={{ textTransform: 'uppercase' }} />
          </Field>
          <Field label={t('pr.coupons.fieldTitle')}>
            <input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder={t('pr.coupons.titleHint')} />
          </Field>
          <Field label={t('pr.coupons.fieldDiscountType')} required>
            <select value={form.discount_type} onChange={(e) => set('discount_type', e.target.value)}>
              <option value="percent">{t('pr.coupons.typePercent')}</option>
              <option value="fixed">{t('pr.coupons.typeFixed')}</option>
            </select>
          </Field>
          <Field label={t(form.discount_type === 'percent' ? 'pr.coupons.fieldDiscountValue.percent' : 'pr.coupons.fieldDiscountValue.fixed')} required>
            <input type="number" min="0" value={form.discount_value} onChange={(e) => set('discount_value', e.target.value)} />
          </Field>
          <Field label={t('pr.coupons.fieldMinAmount')}>
            <input type="number" min="0" value={form.min_amount} onChange={(e) => set('min_amount', e.target.value)} placeholder={t('pr.coupons.minAmountHint')} />
          </Field>
          <Field label={t('pr.coupons.fieldExpiry')}>
            <input type="date" value={form.ends_at} onChange={(e) => set('ends_at', e.target.value)} />
          </Field>
          <Field label={t('pr.coupons.fieldMaxUses')}>
            <input type="number" min="0" value={form.max_uses} onChange={(e) => set('max_uses', e.target.value)} placeholder={t('pr.coupons.maxUsesHint')} />
          </Field>
          <Field label={t('pr.coupons.fieldPerCustomer')}>
            <input type="number" min="0" value={form.per_customer_limit} onChange={(e) => set('per_customer_limit', e.target.value)} placeholder={t('pr.coupons.perCustomerHint')} />
          </Field>
        </div>
        <Toggle checked={form.is_active} onChange={(v) => set('is_active', v)} label={t('pr.coupons.activeToggle')} />
        <div className="form-actions">
          <button className="btn btn-outline" onClick={() => setEditing(null)}>{t('pr.coupons.cancel')}</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? t('pr.coupons.saving') : (editing?.id ? t('pr.coupons.saveEdit') : t('pr.coupons.saveCreate'))}</button>
        </div>
      </Modal>

      <Confirm open={!!confirmDel} title={t('pr.coupons.deleteTitle')} message={t('pr.coupons.deleteMsg', { code: confirmDel?.code || '' })} confirmText={t('pr.coupons.deleteConfirm')} danger onCancel={() => setConfirmDel(null)} onConfirm={deleteCoupon} />
    </div>
  );
}