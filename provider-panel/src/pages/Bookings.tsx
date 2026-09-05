import { useEffect, useState } from 'react';
import { api } from '../api';
import { useToast, fmt, fmtDate, PageLoading, EmptyState, Modal, Badge, Field, Pagination } from '@rafidain/shared/ui';
import { CATALOGS, ROOM_TYPES } from '../catalog';
import { PageHead } from '@rafidain/shared/ui';
import { t } from '@rafidain/shared/i18n';
import { useLocale } from '@rafidain/shared';

export default function Bookings() {
  const [rows, setRows] = useState<any>(null);
  const [meta, setMeta] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [serviceSlug, setServiceSlug] = useState('');
  const [dates, setDates] = useState<{ check_in?: string; check_out?: string; travel_from?: string; travel_to?: string }>({});
  const [selected, setSelected] = useState<any>(null);
  const [rooms, setRooms] = useState<any>(null);
  const [roomForm, setRoomForm] = useState({ room_type: '', total_rooms: '' });
  const [roomForm2, setRoomForm2] = useState({ id: 0, room_type: '', total_rooms: '' });
  const [saving, setSaving] = useState(false);
  const [changing, setChanging] = useState<{ id: number; status: string } | null>(null);
  const [changeReason, setChangeReason] = useState('');
  const toast = useToast();
  useLocale();

  const load = (pg = page) => {
    const p = new URLSearchParams();
    if (serviceSlug) p.set('service_slug', serviceSlug);
    if (dates.check_in) p.set('check_in', dates.check_in);
    if (dates.check_out) p.set('check_out', dates.check_out);
    if (dates.travel_from) p.set('travel_from', dates.travel_from);
    if (dates.travel_to) p.set('travel_to', dates.travel_to);
    p.set('page', String(pg));
    p.set('limit', '20');
    const qs = p.toString();
    api.get(`/provider/bookings${qs ? '?' + qs : ''}`).then((r) => { setRows(r.data); setMeta(r.meta || null); }).catch((e) => toast.error(e.message));
  };

  useEffect(() => { load(); }, [page]);
  useEffect(() => { setPage(1); load(1); }, [serviceSlug, dates]);

  const view = async (row: any) => {
    try {
      const res = await api.get(`/provider/bookings/${row.id}`);
      setSelected(res.data);
      if (serviceSlug === 'hotels') {
        const res2 = await api.get(`/provider/bookings/${row.id}/rooms`);
        setRooms(res2.data);
      }
    } catch (e: any) { toast.error(e.message); }
  };

  const addRoom = async () => {
    setSaving(true);
    try {
      await api.post(`/provider/bookings/${selected.id}/rooms`, roomForm);
      const res2 = await api.get(`/provider/bookings/${selected.id}/rooms`);
      setRooms(res2.data);
      setRoomForm({ room_type: '', total_rooms: '' });
      toast.success(t('pr.bookings.roomAddedToast'));
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  const editRoom = async () => {
    setSaving(true);
    try {
      await api.put(`/provider/bookings/rooms/${roomForm2.id}`, { room_type: roomForm2.room_type, total_rooms: Number(roomForm2.total_rooms) || 1 });
      const res2 = await api.get(`/provider/bookings/${selected.id}/rooms`);
      setRooms(res2.data);
      setRoomForm2({ id: 0, room_type: '', total_rooms: '' });
      toast.success(t('pr.bookings.roomUpdatedToast'));
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  const deleteRoom = async (id: number) => {
    try {
      await api.del(`/provider/bookings/rooms/${id}`);
      const res2 = await api.get(`/provider/bookings/${selected.id}/rooms`);
      setRooms(res2.data);
      toast.success(t('pr.bookings.roomDeletedToast'));
    } catch (e: any) { toast.error(e.message); }
  };

  const changeStatus = async (next: string, reason = '') => {
    setSaving(true);
    try {
      await api.put(`/provider/bookings/${selected.id}/status`, { status: next, reason });
      toast.success(t('pr.bookings.statusToast'));
      setChanging(null);
      setChangeReason('');
      view({ id: selected.id });
      load();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  const cat = (CATALOGS as Record<string, any>)[serviceSlug];

  if (!rows) return <PageLoading />;

  const roomStatusBadge = (status: string) => {
    const map: Record<string, any> = { available: { label: t('pr.bookings.roomAvailable'), cls: 'badge-green' }, unavailable: { label: t('pr.bookings.roomUnavailable'), cls: 'badge-red' } };
    return <Badge status={status} map={map} />;
  };

  return (
    <div>
      <PageHead title={t('pr.bookings.pageTitle')} subtitle={t('pr.bookings.pageSubtitle')} />

      <div className="filters" style={{ marginBottom: 0, borderTop: 'none', paddingTop: 0 }}>
        <select value={serviceSlug} onChange={(e) => setServiceSlug(e.target.value)}>
          <option value="">{t('pr.bookings.allTypes')}</option>
          <option value="hotels">{t('pr.bookings.typeHotels')}</option>
          <option value="flights">{t('pr.bookings.typeFlights')}</option>
          <option value="travel_offices">{t('pr.bookings.typeTravel')}</option>
        </select>
        {serviceSlug === 'hotels' && <input type="date" value={dates.check_in || ''} onChange={(e) => setDates((d) => ({ ...d, check_in: e.target.value }))} title={t('pr.bookings.filterCheckIn')} />}
        {serviceSlug === 'hotels' && <input type="date" value={dates.check_out || ''} onChange={(e) => setDates((d) => ({ ...d, check_out: e.target.value }))} title={t('pr.bookings.filterCheckOut')} />}
        {serviceSlug === 'flights' && <input type="date" value={dates.travel_from || ''} onChange={(e) => setDates((d) => ({ ...d, travel_from: e.target.value }))} title={t('pr.bookings.filterTravelFrom')} />}
        {serviceSlug === 'flights' && <input type="date" value={dates.travel_to || ''} onChange={(e) => setDates((d) => ({ ...d, travel_to: e.target.value }))} title={t('pr.bookings.filterTravelTo')} />}
        {serviceSlug === 'travel_offices' && <input type="date" value={dates.travel_from || ''} onChange={(e) => setDates((d) => ({ ...d, travel_from: e.target.value }))} title={t('pr.bookings.filterTravelFrom')} />}
        {serviceSlug === 'travel_offices' && <input type="date" value={dates.travel_to || ''} onChange={(e) => setDates((d) => ({ ...d, travel_to: e.target.value }))} title={t('pr.bookings.filterTravelTo')} />}
      </div>

      <div className="card">
        <div className="table-wrap">
          {rows.length === 0 ? <EmptyState text={t('pr.bookings.empty')} icon="📅" /> : (
            <table>
              <thead>
                <tr>
                  <th>{t('pr.bookings.thId')}</th><th>{t('pr.bookings.thCustomer')}</th><th>{t('pr.bookings.thDate')}</th><th>{t('pr.bookings.thTravelDate')}</th>
                  <th>{t('pr.bookings.thGuests')}</th><th>{t('pr.bookings.thAmount')}</th><th>{t('pr.bookings.thStatus')}</th><th>{t('pr.bookings.thActions')}</th>
                </tr>
              </thead>
              <tbody>
                 {rows.map((b: any) => (
                  <tr key={b.id}>
                    <td className="mono">#{b.id}</td>
                    <td>{b.customer_name}<div className="muted" style={{ fontSize: 11 }}>{b.customer_phone}</div></td>
                    <td>{fmtDate(b.booking_date)}</td>
                    <td>{fmtDate(b.travel_date)}</td>
                    <td>{b.guests || '-'}</td>
                    <td className="bold">{fmt(b.total_amount)}</td>
                    <td><Badge status={b.status} map={{ confirmed: { label: t('pr.bookings.statusConfirmed'), cls: 'badge-green' }, pending: { label: t('pr.bookings.statusPending'), cls: 'badge-amber' }, cancelled: { label: t('pr.bookings.statusCancelled'), cls: 'badge-red' } }} /></td>
                    <td><button className="btn btn-outline btn-sm" onClick={() => view(b)}>{t('pr.bookings.detailsBtn')}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Pagination meta={meta} page={page} onChange={setPage} />

      <Modal open={!!selected} title={t('pr.bookings.modalTitle', { id: selected?.id || '' })} onClose={() => setSelected(null)} size="lg">
        {selected && (
          <>
            <div className="detail-grid mb-4">
              <div className="detail-item"><div className="k">{t('pr.bookings.detailCustomer')}</div><div className="v">{selected.customer_name}<div className="muted">{selected.customer_phone}</div></div></div>
              <div className="detail-item"><div className="k">{t('pr.bookings.detailStatus')}</div><div className="v"><Badge status={selected.status} map={{ confirmed: { label: t('pr.bookings.statusConfirmed'), cls: 'badge-green' }, pending: { label: t('pr.bookings.statusPending'), cls: 'badge-amber' }, cancelled: { label: t('pr.bookings.statusCancelled'), cls: 'badge-red' } }} /></div></div>
              <div className="detail-item"><div className="k">{t('pr.bookings.detailBookingDate')}</div><div className="v">{fmtDate(selected.booking_date)}</div></div>
              <div className="detail-item"><div className="k">{t('pr.bookings.detailTotal')}</div><div className="v">{fmt(selected.total_amount)}</div></div>
              <div className="detail-item"><div className="k">{t('pr.bookings.detailGuests')}</div><div className="v">{selected.guests}</div></div>
              <div className="detail-item"><div className="k">{t('pr.bookings.detailPayment')}</div><div className="v">{selected.payment_method || '-'}</div></div>
              <div className="detail-item"><div className="k">{t('pr.bookings.detailCheckIn')}</div><div className="v">{fmtDate(selected.check_in)}</div></div>
              <div className="detail-item"><div className="k">{t('pr.bookings.detailCheckOut')}</div><div className="v">{fmtDate(selected.check_out)}</div></div>
              {selected.nights && <div className="detail-item"><div className="k">{t('pr.bookings.detailNights')}</div><div className="v">{selected.nights}</div></div>}
              {selected.title && <div className="detail-item"><div className="k">{t('pr.bookings.detailFlightTitle')}</div><div className="v">{selected.title}</div></div>}
              {selected.passengers && <div className="detail-item"><div className="k">{t('pr.bookings.detailPassengers')}</div><div className="v">{selected.passengers}</div></div>}
              {selected.travel_date && <div className="detail-item"><div className="k">{t('pr.bookings.detailTravelDate')}</div><div className="v">{fmtDate(selected.travel_date)}</div></div>}
            </div>

            {selected.status === 'cancelled' && selected.cancel_reason && (
              <div className="alert-error mb-4">
                <strong>{t('pr.bookings.cancelReasonLabel')}</strong> {selected.cancel_reason}
              </div>
            )}

            {selected.status === 'cancelled' && !selected.cancel_reason && (
              <div className="alert-error mb-4">
                <strong>{t('pr.bookings.cancelReasonLabel')}</strong> {t('pr.bookings.noReason')}
              </div>
            )}

            {selected.status === 'pending' && (
              <div className="flex gap-sm mb-4">
                <button className="btn btn-success btn-sm" onClick={() => changeStatus('confirmed')}>{t('pr.bookings.acceptBtn')}</button>
                <button className="btn btn-outline btn-sm" onClick={() => { setChangeReason(''); setChanging({ id: selected.id, status: 'cancelled' }); }}>{t('pr.bookings.rejectBtn')}</button>
              </div>
            )}

            {selected.status === 'confirmed' && (
              <div className="flex gap-sm mb-4">
                <button className="btn btn-outline btn-sm" onClick={() => { setChangeReason(''); setChanging({ id: selected.id, status: 'cancelled' }); }}>{t('pr.bookings.cancelBtn')}</button>
              </div>
            )}

            {serviceSlug === 'hotels' && selected.status !== 'cancelled' && (
              <div className="card mb-4">
                <div className="card-header"><h3>{t('pr.bookings.roomAvailabilityTitle')}</h3></div>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>{t('pr.bookings.thRoomType')}</th><th>{t('pr.bookings.thRoomCount')}</th><th>{t('pr.bookings.thStatus')}</th><th>{t('pr.bookings.thActions')}</th></tr></thead>
                    <tbody>
                       {(rooms || []).map((rm: any) => (
                        <tr key={rm.id}>
                          <td>{t((ROOM_TYPES as Record<string, any>)[rm.room_type] || rm.room_type)}</td>
                          <td>{rm.total_rooms}</td>
                          <td>{roomStatusBadge(rm.status)}</td>
                          <td>
                            <div className="flex gap-sm">
                              <button className="btn btn-outline btn-sm" onClick={() => setRoomForm2({ id: rm.id, room_type: rm.room_type, total_rooms: rm.total_rooms })}>{t('pr.bookings.roomEditBtn')}</button>
                              <button className="btn btn-outline btn-sm btn-danger-ghost" onClick={() => deleteRoom(rm.id)}>{t('pr.bookings.roomDeleteBtn')}</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="card-body">
                  <div className="filters">
                    <select value={roomForm.room_type} onChange={(e) => setRoomForm({ ...roomForm, room_type: e.target.value })}>
                      <option value="">{t('pr.bookings.roomSelectType')}</option>
                      {Object.entries(ROOM_TYPES).filter(([k]) => k !== 'single' && k !== 'double').map(([k, v]) => <option key={k} value={k}>{t(v as string)}</option>)}
                    </select>
                    <input type="number" min="1" placeholder={t('pr.bookings.roomCountPlaceholder')} value={roomForm.total_rooms} onChange={(e) => setRoomForm({ ...roomForm, total_rooms: e.target.value })} style={{ width: 120 }} />
                    <button className="btn btn-primary btn-sm" disabled={!roomForm.room_type || !roomForm.total_rooms || saving} onClick={addRoom}>{t('pr.bookings.roomAddBtn')}</button>
                  </div>
                </div>
              </div>
            )}

            {serviceSlug === 'hotels' && selected.status !== 'cancelled' && (
              <div className="card mb-4">
                <div className="card-header"><h3>{t('pr.bookings.existingRoomsTitle')}</h3></div>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>{t('pr.bookings.thRoomType')}</th><th>{t('pr.bookings.thRoomCount')}</th><th>{t('pr.bookings.thStatus')}</th></tr></thead>
                    <tbody>
                       {(rooms || []).map((rm: any) => (
                        <tr key={rm.id}>
                          <td>{t((ROOM_TYPES as Record<string, any>)[rm.room_type] || rm.room_type)}</td>
                          <td>{rm.total_rooms}</td>
                          <td>{roomStatusBadge(rm.status)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <Modal open={!!roomForm2.id} title={t('pr.bookings.roomEditTitle')} onClose={() => setRoomForm2({ id: 0, room_type: '', total_rooms: '' })} size="md">
              <div className="form-grid">
                <Field label={t('pr.bookings.roomTypeLabel')} required>
                  <select value={roomForm2.room_type} onChange={(e) => setRoomForm2({ ...roomForm2, room_type: e.target.value })}>
                    {Object.entries(ROOM_TYPES).filter(([k]) => k !== 'single' && k !== 'double').map(([k, v]) => <option key={k} value={k}>{t(v as string)}</option>)}
                  </select>
                </Field>
                <Field label={t('pr.bookings.roomCountLabel')} required>
                  <input type="number" min="1" value={roomForm2.total_rooms} onChange={(e) => setRoomForm2({ ...roomForm2, total_rooms: e.target.value })} />
                </Field>
              </div>
              <div className="flex gap-sm" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
                <button className="btn btn-outline" onClick={() => setRoomForm2({ id: 0, room_type: '', total_rooms: '' })}>{t('pr.bookings.roomCancelBtn')}</button>
                <button className="btn btn-primary" disabled={saving} onClick={editRoom}>{saving ? t('pr.bookings.roomSaving') : t('pr.bookings.roomSaveBtn')}</button>
              </div>
            </Modal>
          </>
        )}
      </Modal>

      <Modal open={!!changing} title={changing?.status === 'cancelled' ? t('pr.bookings.rejectModalTitle.pending') : t('pr.bookings.rejectModalTitle.other')} onClose={() => setChanging(null)}>
        <Field label={changing?.status === 'cancelled' ? t('pr.bookings.rejectReasonLabel.pending') : t('pr.bookings.rejectReasonLabel.other')} required>
          <textarea rows={3} value={changeReason} onChange={(e) => setChangeReason(e.target.value)} placeholder={t('pr.bookings.rejectPlaceholder')} />
        </Field>
        <div className="form-actions">
          <button className="btn btn-outline" onClick={() => setChanging(null)}>{t('pr.bookings.cancelReject')}</button>
          <button className="btn btn-danger" disabled={saving || !changeReason.trim()} onClick={() => changeStatus(changing!.status, changeReason.trim())}>{saving ? t('pr.bookings.saving') : t('pr.bookings.rejectAction.pending')}</button>
        </div>
      </Modal>
    </div>
  );
}
