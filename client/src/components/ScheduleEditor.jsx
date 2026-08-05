import { useEffect, useMemo, useState } from 'react';
import BottomSheet from './BottomSheet';
import { DAYS } from '../constants';
import { todayDayName } from '../utils/format';

const ROLES = [
  { key: 'cooking', label: '🍳' },
  { key: 'cleaning', label: '🧹' },
  { key: 'homeClean', label: '🏠' },
  { key: 'resting', label: '😴' }
];

export default function ScheduleEditor({ open, onClose, chores, users, initialDay, onSave, loading }) {
  const [day, setDay] = useState(initialDay || todayDayName());
  const [assign, setAssign] = useState({});

  useEffect(() => {
    if (!open) return;
    const baseDay = initialDay || todayDayName();
    setDay(baseDay);
    const schedule = chores.find((c) => c.day === baseDay);
    const map = {};
    if (schedule) {
      for (const m of schedule.cooking) map[m._id] = 'cooking';
      for (const m of schedule.cleaning) map[m._id] = 'cleaning';
      if (schedule.homeClean) map[schedule.homeClean._id] = 'homeClean';
      for (const m of schedule.resting) if (!map[m._id]) map[m._id] = 'resting';
    }
    setAssign(map);
  }, [open, chores, initialDay]);

  const counts = useMemo(() => {
    const c = { cooking: 0, cleaning: 0, homeClean: 0, resting: 0 };
    for (const v of Object.values(assign)) c[v] = (c[v] || 0) + 1;
    return c;
  }, [assign]);

  const errors = [];
  if (counts.cooking !== 2) errors.push(`Cooking needs exactly 2 people (currently ${counts.cooking}).`);
  if (counts.cleaning !== 2) errors.push(`Cleaning needs exactly 2 people (currently ${counts.cleaning}).`);
  if (counts.homeClean !== 1) errors.push('Home Clean needs exactly 1 person.');

  const valid = errors.length === 0 && users.length === 9;

  const setRole = (userId, role) => {
    setAssign((m) => {
      const next = { ...m };
      if (role === 'resting') delete next[userId];
      else next[userId] = role;
      return next;
    });
  };

  const handleSave = () => {
    if (!valid) return;
    const cooking = users.filter((u) => assign[u._id] === 'cooking').map((u) => u._id);
    const cleaning = users.filter((u) => assign[u._id] === 'cleaning').map((u) => u._id);
    const homeClean = users.find((u) => assign[u._id] === 'homeClean')?._id || null;
    onSave({ day, cooking, cleaning, homeClean });
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Edit Schedule"
      footer={
        <div className="sheet-actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary" disabled={!valid || loading} onClick={handleSave}>
            {loading ? 'Saving…' : 'Save Schedule'}
          </button>
        </div>
      }
    >
      <label className="field-label">Day</label>
      <select
        className="text-input"
        value={day}
        onChange={(e) => {
          const next = e.target.value;
          setDay(next);
          const schedule = chores.find((c) => c.day === next);
          const map = {};
          if (schedule) {
            for (const m of schedule.cooking) map[m._id] = 'cooking';
            for (const m of schedule.cleaning) map[m._id] = 'cleaning';
            if (schedule.homeClean) map[schedule.homeClean._id] = 'homeClean';
            for (const m of schedule.resting) if (!map[m._id]) map[m._id] = 'resting';
          }
          setAssign(map);
        }}
      >
        {DAYS.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>

      <div className="schedule-editor">
        {users.map((u) => (
          <div key={u._id} className="schedule-editor__row">
            <span className="schedule-editor__name">{u.name}</span>
            <div className="role-segmented">
              {ROLES.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  className={`role-segmented__btn ${assign[u._id] === r.key ? 'is-active' : ''}`}
                  onClick={() => setRole(u._id, r.key)}
                  title={r.key}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="editor-counts">
        {ROLES.map((r) => (
          <span key={r.key} className={`editor-count ${counts[r.key] === (r.key === 'homeClean' ? 1 : 2) ? 'is-ok' : ''}`}>
            {r.label} {counts[r.key]}
          </span>
        ))}
      </div>

      {errors.map((e) => (
        <div key={e} className="notice notice--error">
          {e}
        </div>
      ))}
    </BottomSheet>
  );
}
