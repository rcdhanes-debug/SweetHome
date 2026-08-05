import { useEffect, useState } from 'react';
import { ChefHat, Brush, Home } from 'lucide-react';
import BottomSheet from './BottomSheet';
import { DAYS } from '../constants';
import { todayDayName } from '../utils/format';

const ROLE_CONFIG = [
  { key: 'cooking',   label: 'Cooking',    icon: ChefHat, count: 2, color: '#f59e0b' },
  { key: 'cleaning',  label: 'Cleaning',   icon: Brush,   count: 2, color: '#0ea5e9' },
  { key: 'homeClean', label: 'Home Clean', icon: Home,    count: 1, color: '#10b981' }
];

function initialState(schedule, users) {
  if (!schedule) return { cooking: ['', ''], cleaning: ['', ''], homeClean: [''] };
  const pick = (arr) => arr.map((m) => String(m._id));
  return {
    cooking:   [...pick(schedule.cooking),   ''].slice(0, 2),
    cleaning:  [...pick(schedule.cleaning),  ''].slice(0, 2),
    homeClean: [schedule.homeClean ? String(schedule.homeClean._id) : '']
  };
}

export default function ScheduleEditor({ open, onClose, chores, users, initialDay, onSave, loading }) {
  const [day, setDay] = useState(initialDay || todayDayName());
  const [slots, setSlots] = useState({ cooking: ['', ''], cleaning: ['', ''], homeClean: [''] });

  useEffect(() => {
    if (!open) return;
    const baseDay = initialDay || todayDayName();
    setDay(baseDay);
    setSlots(initialState(chores.find((c) => c.day === baseDay), users));
  }, [open, chores, initialDay]);

  const handleDayChange = (next) => {
    setDay(next);
    setSlots(initialState(chores.find((c) => c.day === next), users));
  };

  const setSlot = (role, idx, userId) => {
    setSlots((prev) => {
      const arr = [...prev[role]];
      arr[idx] = userId;
      return { ...prev, [role]: arr };
    });
  };

  // All currently assigned IDs so we can grey them out in dropdowns
  const allAssigned = new Set(
    [...slots.cooking, ...slots.cleaning, ...slots.homeClean].filter(Boolean)
  );

  const errors = [];
  if (slots.cooking.some((x) => !x))   errors.push('Assign 2 people for Cooking.');
  if (slots.cleaning.some((x) => !x))  errors.push('Assign 2 people for Cleaning.');
  if (!slots.homeClean[0])              errors.push('Assign 1 person for Home Clean.');
  const allIds = [...slots.cooking, ...slots.cleaning, ...slots.homeClean].filter(Boolean);
  if (new Set(allIds).size !== allIds.length) errors.push('Same person cannot be in two roles.');

  const valid = errors.length === 0;

  const handleSave = () => {
    if (!valid) return;
    onSave({
      day,
      cooking:   slots.cooking,
      cleaning:  slots.cleaning,
      homeClean: slots.homeClean[0]
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
        {ROLE_CONFIG.map(({ key, label, icon: Icon, count, color }) => (
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
              {slots[key].map((val, idx) => (
                <select
                  key={idx}
                  className="text-input"
                  value={val}
                  style={{ fontSize: '13px' }}
                  onChange={(e) => setSlot(key, idx, e.target.value)}
                >
                  <option value="">— Select person —</option>
                  {users.map((u) => (
                    <option
                      key={u._id}
                      value={u._id}
                      disabled={allAssigned.has(String(u._id)) && String(u._id) !== val}
                    >
                      {u.name}
                    </option>
                  ))}
                </select>
              ))}
            </div>
          </div>
        ))}
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
