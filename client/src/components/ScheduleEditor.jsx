import { useEffect, useState } from 'react';
import { ChefHat, Moon, Brush } from 'lucide-react';
import BottomSheet from './BottomSheet';
import { DAYS } from '../constants';
import { todayDayName } from '../utils/format';

const ROLE_CONFIG = [
  { key: 'morningCooking', label: 'Morning Cooking', icon: ChefHat, count: 2, color: '#f59e0b' },
  { key: 'nightCooking',   label: 'Night Cooking',   icon: Moon,    count: 2, color: '#f97316', optionalForWeekends: true },
  { key: 'cleaning',       label: 'Daily Cleaning',  icon: Brush,   count: 2, color: '#0ea5e9' }
];

function isWeekend(d) {
  return d === 'Saturday' || d === 'Sunday';
}

function initialState(schedule, users, day) {
  if (!schedule) return { morningCooking: ['', ''], nightCooking: ['', ''], cleaning: ['', ''] };
  const pick = (arr) => (arr || []).map((m) => String(m._id));
  return {
    morningCooking: [...pick(schedule.morningCooking), ''].slice(0, 2),
    nightCooking:   isWeekend(day) ? [] : [...pick(schedule.nightCooking), ''].slice(0, 2),
    cleaning:       [...pick(schedule.cleaning), ''].slice(0, 2)
  };
}

export default function ScheduleEditor({ open, onClose, chores, users, initialDay, onSave, loading }) {
  const [day, setDay] = useState(initialDay || todayDayName());
  const [slots, setSlots] = useState({ morningCooking: ['', ''], nightCooking: ['', ''], cleaning: ['', ''] });

  useEffect(() => {
    if (!open) return;
    const baseDay = initialDay || todayDayName();
    setDay(baseDay);
    setSlots(initialState(chores.find((c) => c.day === baseDay), users, baseDay));
  }, [open, chores, initialDay, users]);

  const handleDayChange = (next) => {
    setDay(next);
    setSlots(initialState(chores.find((c) => c.day === next), users, next));
  };

  const setSlot = (role, idx, userId) => {
    setSlots((prev) => {
      const arr = [...(prev[role] || [])];
      arr[idx] = userId;
      return { ...prev, [role]: arr };
    });
  };

  const weekend = isWeekend(day);
  const errors = [];
  if (slots.morningCooking.some((x) => !x)) errors.push('Assign 2 people for Morning Cooking.');
  if (slots.cleaning.some((x) => !x)) errors.push('Assign 2 people for Daily Cleaning.');
  if (!weekend && slots.nightCooking.some((x) => !x)) {
    errors.push('Assign 2 people for Night Cooking.');
  }

  if (slots.morningCooking[0] && slots.morningCooking[0] === slots.morningCooking[1]) {
    errors.push('Morning Cooking team cannot have the same person twice.');
  }
  if (!weekend && slots.nightCooking[0] && slots.nightCooking[0] === slots.nightCooking[1]) {
    errors.push('Night Cooking team cannot have the same person twice.');
  }
  if (slots.cleaning[0] && slots.cleaning[0] === slots.cleaning[1]) {
    errors.push('Cleaning team cannot have the same person twice.');
  }

  const valid = errors.length === 0;

  const handleSave = () => {
    if (!valid) return;
    onSave({
      day,
      morningCooking: slots.morningCooking,
      nightCooking:   weekend ? [] : slots.nightCooking,
      cleaning:       slots.cleaning
    });
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Edit Schedule"
      footer={
        <div className="sheet-actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn--primary" disabled={!valid || loading} onClick={handleSave}>
            {loading ? 'Saving…' : 'Save Schedule'}
          </button>
        </div>
      }
    >
      {/* Day selector */}
      <div style={{ marginBottom: '18px' }}>
        <label className="field-label">Day</label>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {DAYS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => handleDayChange(d)}
              style={{
                padding: '5px 12px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: 600,
                border: '1px solid var(--border)',
                background: day === d ? 'var(--accent)' : 'var(--surface-2)',
                color: day === d ? '#fff' : 'var(--text)',
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              {d.slice(0, 3)}
            </button>
          ))}
        </div>
      </div>

      {/* Role cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {ROLE_CONFIG.map(({ key, label, icon: Icon, count, color, optionalForWeekends }) => {
          if (optionalForWeekends && weekend) return null;
          return (
            <div
              key={key}
              style={{
                background: 'var(--surface-2)',
                borderRadius: '14px',
                padding: '14px 16px',
                border: `1px solid ${color}33`
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <Icon size={16} style={{ color }} />
                <span style={{ fontWeight: 700, fontSize: '13px', color }}>
                  {label}
                </span>
                <span style={{
                  marginLeft: 'auto',
                  fontSize: '11px',
                  color: 'var(--muted)',
                  background: 'var(--surface-1)',
                  borderRadius: '8px',
                  padding: '2px 8px'
                }}>
                  {count} {count === 1 ? 'person' : 'people'}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {(slots[key] || ['', '']).map((val, idx) => (
                  <select
                    key={idx}
                    className="text-input"
                    value={val}
                    style={{ fontSize: '13px' }}
                    onChange={(e) => setSlot(key, idx, e.target.value)}
                  >
                    <option value="">— Select person —</option>
                    {users.map((u) => {
                      const isSameRoleDuplicate =
                        (slots[key] || []).some((id, i) => i !== idx && String(id) === String(u._id));
                      return (
                        <option
                          key={u._id}
                          value={u._id}
                          disabled={isSameRoleDuplicate}
                        >
                          {u.name}
                        </option>
                      );
                    })}
                  </select>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {errors.map((e) => (
            <div key={e} className="notice notice--error" style={{ fontSize: '12px' }}>{e}</div>
          ))}
        </div>
      )}
    </BottomSheet>
  );
}
