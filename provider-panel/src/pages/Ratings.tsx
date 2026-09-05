import { useEffect, useState } from 'react';
import { api } from '../api';
import { useToast, fmt, fmtDate, PageLoading, EmptyState, StatCard, Modal, Field, Pagination } from '@rafidain/shared/ui';
import { PageHead } from '@rafidain/shared/ui';
import { t } from '@rafidain/shared/i18n';
import { useLocale } from '@rafidain/shared';

function Stars({ value }: { value: number }) {
  const v = Math.max(0, Math.min(5, Math.round(Number(value) || 0)));
  return <span className="bold" style={{ color: 'var(--gold)' }}>{'★'.repeat(v)}{'☆'.repeat(5 - v)}</span>;
}

export default function Ratings() {
  const [rows, setRows] = useState<any>(null);
  const [meta, setMeta] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [replyTarget, setReplyTarget] = useState<any>(null);
  const [replyText, setReplyText] = useState('');
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  useLocale();

  const load = (pg = page) => {
    const p = new URLSearchParams();
    p.set('page', String(pg));
    p.set('limit', '20');
    const qs = p.toString();
    api.get(`/provider/ratings${qs ? '?' + qs : ''}`).then((r) => { setRows(r.data); setMeta(r.meta || null); }).catch((e) => toast.error(e.message));
  };
  useEffect(() => { load(); }, [page]);

  const reply = async () => {
    if (!replyText.trim()) return;
    setSaving(true);
    try {
      await api.put(`/provider/ratings/${replyTarget.id}/reply`, { reply: replyText.trim() });
      toast.success(replyTarget.reply ? t('pr.ratings.replyUpdatedToast') : t('pr.ratings.replySentToast'));
      setReplyTarget(null);
      setReplyText('');
      load();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  const openReply = (r: any) => {
    setReplyTarget(r);
    setReplyText(r.reply || '');
  };

  if (!rows) return <PageLoading />;

  return (
    <div>
      <PageHead title={t('pr.ratings.title')} subtitle={t('pr.ratings.subtitle')} />

      <div className="grid grid-4 mb-4">
        <StatCard label={t('pr.ratings.avgLabel')} value={`${meta?.rating ?? 0} / 5`} icon="⭐" tone="success" />
        <StatCard label={t('pr.ratings.countLabel')} value={fmt(meta?.rating_count ?? 0)} icon="🗣️" tone="primary" />
        <StatCard label={t('pr.ratings.noReplyLabel')} value={fmt(meta?.no_reply_count ?? 0)} icon="✉️" tone="info" />
      </div>

      <div className="card">
        <div className="table-wrap">
          {rows.length === 0 ? <EmptyState text={t('pr.ratings.empty')} icon="⭐" /> : (
            <table>
              <thead><tr><th>{t('pr.ratings.thCustomer')}</th><th>{t('pr.ratings.thRating')}</th><th>{t('pr.ratings.thComment')}</th><th>{t('pr.ratings.thReply')}</th><th>{t('pr.ratings.thOrder')}</th><th>{t('pr.ratings.thDate')}</th><th>{t('pr.ratings.thActions')}</th></tr></thead>
              <tbody>
                 {rows.map((r: any) => (
                  <tr key={r.id}>
                    <td>{r.customer_name || t('pr.ratings.customerFallback')}</td>
                    <td><Stars value={r.rating} /></td>
                    <td className="muted">{r.comment || t('pr.ratings.noComment')}</td>
                    <td className="muted">{r.reply || t('pr.ratings.noReply')}</td>
                    <td>{r.order_number || '-'}</td>
                    <td className="muted">{fmtDate(r.created_at)}</td>
                    <td><button className="btn btn-outline btn-sm" onClick={() => openReply(r)}>{r.reply ? t('pr.ratings.editReply') : t('pr.ratings.replyBtn')}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Pagination meta={meta} page={page} onChange={setPage} />

      <Modal open={!!replyTarget} title={t('pr.ratings.replyModalTitle', { name: replyTarget?.customer_name || t('pr.ratings.customerFallback') })} onClose={() => setReplyTarget(null)}>
        {replyTarget && (
          <>
            <p className="muted mb-4">{t('pr.ratings.replyFrom', { name: replyTarget.customer_name || t('pr.ratings.customerFallback') })}</p>
            <div className="detail-grid mb-4">
              <div className="detail-item"><div className="k">{t('pr.ratings.thRating')}</div><div className="v"><Stars value={replyTarget.rating} /></div></div>
              <div className="detail-item"><div className="k">{t('pr.ratings.thComment')}</div><div className="v">{replyTarget.comment || t('pr.ratings.noComment')}</div></div>
              <div className="detail-item"><div className="k">{t('pr.ratings.thOrder')}</div><div className="v">{replyTarget.order_number || '-'}</div></div>
              <div className="detail-item"><div className="k">{t('pr.ratings.thDate')}</div><div className="v">{fmtDate(replyTarget.created_at)}</div></div>
            </div>
            <Field label={t('pr.ratings.replyField')}>
              <textarea rows={3} value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder={t('pr.ratings.replyPlaceholder')} />
            </Field>
            <div className="form-actions">
              <button className="btn btn-outline" onClick={() => setReplyTarget(null)}>{t('pr.ratings.cancel')}</button>
              <button className="btn btn-primary" onClick={reply} disabled={saving}>{saving ? t('pr.ratings.saving') : (replyTarget.reply ? t('pr.ratings.updateReplyBtn') : t('pr.ratings.sendReplyBtn'))}</button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}