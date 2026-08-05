import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Trash2, Pencil, MapPin, Clock } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import * as eventApi from '../services/events';
import BottomSheet from '../components/BottomSheet';
import ConfirmModal from '../components/ConfirmModal';
import Skeleton from '../components/Skeleton';
import EmptyState from '../components/EmptyState';
import { EVENT_META, EVENT_TYPES } from '../constants';
import { monthKey, monthLabel, todayISTDateString } from '../utils/format';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function buildGrid(cursor) {
  const [y, m] = cursor.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const startWeekday = first.getUTCDay();
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells = [];
  for (let i = 0; i < startWeekday; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(`${cursor}-${String(d).padStart(2, '0')}`);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function dayKey(dateStr) {
  return dateStr.slice(8, 10);
}

export default function Calendar() {
  const { users, events, loading, reloadEvents } = useApp();
  const { session, isAdmin, runWithAuth } = useAuth();
  const toast = useToast();

  const [cursor, setCursor] = useState(() => monthKey());
  const [monthEvents, setMonthEvents] = useState([]);
  const [monthLoading, setMonthLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const [title, setTitle] = useState('');
  const [type, setType] = useState('other');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [userId, setUserId] = useState('');

  const meId = session?.user?._id;

  useEffect(() => {
    const [y, m] = cursor.split('-').map(Number);
    const start = `${cursor}-01`;
    const end = `${cursor}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`;
    let active = true;
    setMonthLoading(true);
    eventApi
      .listEvents(start, end)
      .then((list) => {
        if (active) setMonthEvents(list);
      })
      .catch(() => {
        if (active) setMonthEvents([]);
      })
      .finally(() => {
        if (active) setMonthLoading(false);
      });
    return () => {
      active = false;
    };
  }, [cursor]);

  const cells = useMemo(() => buildGrid(cursor), [cursor]);
  const todayStr = todayISTDateString();

  const eventsByDay = useMemo(() => {
    const map = {};
    monthEvents.forEach((e) => {
      (map[e.date] = map[e.date] || []).push(e);
    });
    return map;
  }, [monthEvents]);

  const canManage = (e) => !e.auto && (isAdmin || (meId && String(e.createdBy) === String(meId)));

  const openCreate = (d) => {
    setEditing(null);
    setTitle('');
    setType('other');
    setDate(d || todayStr);
    setTime('');
    setLocation('');
    setNotes('');
    setUserId('');
    setFormOpen(true);
  };

  const openEdit = (e) => {
    setEditing(e);
    setTitle(e.title);
    setType(e.type);
    setDate(e.date);
    setTime(e.time || '');
    setLocation(e.location || '');
    setNotes(e.notes || '');
    setUserId(e.userId || '');
    setFormOpen(true);
  };

  const doSave = async () => {
    if (!title.trim()) return;
    setBusy(true);
    try {
      const payload = { title: title.trim(), type, date, time, location: location.trim(), notes: notes.trim(), userId: userId || null };
      await runWithAuth(
        { title: editing ? 'Edit Event' : 'Add Event', subtitle: title.trim(), adminOnly: false, defaultName: session?.user?.name },
        (token) => (editing ? eventApi.updateEvent(token, editing._id, payload) : eventApi.createEvent(token, payload))
      );
      toast.show(editing ? '✓ Event updated' : '✓ Event added');
      setFormOpen(false);
      setMonthEvents(await eventApi.listEvents(`${cursor}-01`, `${cursor}-${cells.filter(Boolean).length}`));
      reloadEvents();
    } catch (err) {
      if (err.message !== 'Cancelled') toast.show(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await runWithAuth(
        { title: 'Delete Event', subtitle: deleteTarget.title, adminOnly: false, defaultName: session?.user?.name },
        (token) => eventApi.deleteEvent(token, deleteTarget._id)
      );
      toast.show('Event removed');
      setDeleteTarget(null);
      setMonthEvents(await eventApi.listEvents(`${cursor}-01`, `${cursor}-${cells.filter(Boolean).length}`));
      reloadEvents();
    } catch (err) {
      if (err.message !== 'Cancelled') toast.show(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const prev = () => {
    const [y, m] = cursor.split('-').map(Number);
    setCursor(`${m === 1 ? y - 1 : y}-${String(m === 1 ? 12 : m - 1).padStart(2, '0')}`);
  };
  const next = () => {
    const [y, m] = cursor.split('-').map(Number);
    setCursor(`${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}`);
  };

  const dayEvents = selectedDate ? eventsByDay[selectedDate] || [] : [];
  const upcoming = events
    .filter((e) => e.date >= todayStr)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 3);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h2>Calendar</h2>
          <p className="muted">Birthdays, festivals, outings and house events</p>
        </div>
        <button type="button" className="btn btn--primary" onClick={() => openCreate(todayStr)}>
          <Plus size={16} /> Add Event
        </button>
      </div>

      <section className="card">
        <div className="cal-head">
          <button type="button" className="icon-btn" onClick={prev} aria-label="Previous month">
            <ChevronLeft size={18} />
          </button>
          <span className="cal-head__title">{monthLabel(cursor)}</span>
          <button type="button" className="icon-btn" onClick={next} aria-label="Next month">
            <ChevronRight size={18} />
          </button>
        </div>

        {monthLoading ? (
          <div className="stack">
            <Skeleton height={180} />
          </div>
        ) : (
          <>
            <div className="cal-weekdays">
              {WEEKDAYS.map((w) => (
                <span key={w} className="cal-weekdays__cell">
                  {w}
                </span>
              ))}
            </div>
            <div className="cal-grid">
              {cells.map((d, i) => {
                if (!d) return <div key={`e-${i}`} className="cal-cell cal-cell--empty" />;
                const evs = eventsByDay[d] || [];
                const isToday = d === todayStr;
                return (
                  <button
                    key={d}
                    type="button"
                    className={`cal-cell ${isToday ? 'cal-cell--today' : ''}`}
                    onClick={() => setSelectedDate(d)}
                  >
                    <span className="cal-cell__num">{dayKey(d)}</span>
                    {evs.slice(0, 2).map((e) => (
                      <span key={e._id} className="cal-event" style={{ background: `${EVENT_META[e.type]?.color}1f`, color: EVENT_META[e.type]?.color }}>
                        {EVENT_META[e.type]?.icon} {e.title}
                      </span>
                    ))}
                    {evs.length > 2 && <span className="cal-more">+{evs.length - 2} more</span>}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </section>

      <section className="card">
        <div className="card__head">
          <h3>Upcoming</h3>
        </div>
        {loading.events ? (
          <Skeleton height={90} />
        ) : upcoming.length === 0 ? (
          <EmptyState icon="🗓️" title="Nothing scheduled" subtitle="Add a birthday, outing or house event to see it here." />
        ) : (
          <div className="upcoming-list">
            {upcoming.map((e) => (
              <button type="button" key={e._id} className="upcoming-row" onClick={() => setSelectedDate(e.date)}>
                <span className="upcoming-row__icon" style={{ color: EVENT_META[e.type]?.color }}>
                  {EVENT_META[e.type]?.icon}
                </span>
                <div className="upcoming-row__body">
                  <div className="upcoming-row__title">{e.title}</div>
                  <div className="upcoming-row__meta">{e.date}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      <BottomSheet
        open={Boolean(selectedDate)}
        onClose={() => setSelectedDate(null)}
        title={selectedDate ? `${selectedDate} events` : 'Events'}
        maxWidth={520}
      >
        <div className="sheet-actions sheet-actions--start">
          <button type="button" className="btn btn--primary" onClick={() => openCreate(selectedDate)}>
            <Plus size={15} /> Add for this day
          </button>
        </div>
        {dayEvents.length === 0 ? (
          <EmptyState icon="📅" title="No events" subtitle="Nothing planned for this day." />
        ) : (
          <div className="nb-list">
            {dayEvents.map((e) => {
              const meta = EVENT_META[e.type] || EVENT_META.other;
              return (
                <div key={e._id} className="nb-row">
                  <span className="upcoming-row__icon" style={{ color: meta.color }}>
                    {meta.icon}
                  </span>
                  <div className="nb-row__body">
                    <div className="nb-row__text">{e.title}</div>
                    {(e.time || e.location || (e.userId && users.find((u) => String(u._id) === String(e.userId))?.name)) && (
                      <div className="nb-row__meta">
                        {e.time && (
                          <span>
                            <Clock size={12} /> {e.time}
                          </span>
                        )}
                        {e.location && (
                          <span>
                            <MapPin size={12} /> {e.location}
                          </span>
                        )}
                        {e.userId &&
                          (() => {
                            const u = users.find((x) => String(x._id) === String(e.userId));
                            return u ? <span>For {u.name}</span> : null;
                          })()}
                      </div>
                    )}
                    {e.notes && <div className="nb-row__desc">{e.notes}</div>}
                  </div>
                  {canManage(e) && (
                    <div className="nb-row__actions">
                      <button type="button" className="icon-btn icon-btn--sm" onClick={() => openEdit(e)} title="Edit">
                        <Pencil size={15} />
                      </button>
                      <button type="button" className="icon-btn icon-btn--sm" onClick={() => setDeleteTarget(e)} title="Delete">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </BottomSheet>

      <BottomSheet open={formOpen} onClose={() => setFormOpen(false)} title={editing ? 'Edit Event' : 'Add Event'} maxWidth={520}>
        <label className="field-label">Title</label>
        <input className="text-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Diwali dinner" maxLength={80} />

        <label className="field-label">Type</label>
        <div className="type-grid">
          {EVENT_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              className={`type-chip ${type === t ? 'type-chip--on' : ''}`}
              style={{ color: EVENT_META[t].color }}
              onClick={() => setType(t)}
            >
              {EVENT_META[t].icon} {EVENT_META[t].label}
            </button>
          ))}
        </div>

        <label className="field-label">Date</label>
        <input className="text-input text-input--date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />

        <div className="two-col">
          <div>
            <label className="field-label">Time (optional)</label>
            <input className="text-input text-input--date" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
          <div>
            <label className="field-label">For member (optional)</label>
            <select className="text-input" value={userId} onChange={(e) => setUserId(e.target.value)}>
              <option value="">—</option>
              {users.map((u) => (
                <option key={u._id} value={u._id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <label className="field-label">Location (optional)</label>
        <input className="text-input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Pondicherry" maxLength={120} />

        <label className="field-label">Notes (optional)</label>
        <textarea className="text-area" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Details, things to carry…" maxLength={500} rows={3} />

        <div className="sheet-actions">
          <button type="button" className="btn btn--ghost" onClick={() => setFormOpen(false)}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary" disabled={busy || !title.trim() || !date} onClick={doSave}>
            {busy ? 'Saving…' : editing ? 'Save Changes' : 'Add Event'}
          </button>
        </div>
      </BottomSheet>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={doDelete}
        loading={busy}
        title="Delete Event"
        message={`Delete "${deleteTarget?.title}"? This cannot be undone.`}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
