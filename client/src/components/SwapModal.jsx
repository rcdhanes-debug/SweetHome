import { useMemo, useState } from 'react';
import BottomSheet from './BottomSheet';
import { DAYS, DUTY_META } from '../constants';
import { todayDayName } from '../utils/format';

function roleLabel(role) {
  return DUTY_META[role]?.label || 'Resting';
}

export default function SwapModal({ open, onClose, chores, onConfirm, loading }) {
  const [day, setDay] = useState(todayDayName());
  const [personA, setPersonA] = useState('');
  const [personB, setPersonB] = useState('');

  const daySchedule = chores.find((c) => c.day === day);
  const allMembers = useMemo(() => {
    if (!daySchedule) return [];
    return [...daySchedule.cooking, ...daySchedule.cleaning, ...(daySchedule.homeClean ? [daySchedule.homeClean] : []), ...daySchedule.resting].filter(
      (m, i, arr) => arr.findIndex((x) => x._id === m._id) === i
    );
  }, [daySchedule]);

  const roleOf = (id) => {
    if (!daySchedule) return 'resting';
    if (daySchedule.cooking.some((m) => m._id === id)) return 'cooking';
    if (daySchedule.cleaning.some((m) => m._id === id)) return 'cleaning';
    if (daySchedule.homeClean && daySchedule.homeClean._id === id) return 'homeClean';
    return 'resting';
  };

  const a = allMembers.find((m) => m._id === personA);
  const b = allMembers.find((m) => m._id === personB);
  const aRole = personA ? roleOf(personA) : null;
  const bRole = personB ? roleOf(personB) : null;

  const valid = day && personA && personB && personA !== personB;

  const handleConfirm = () => {
    if (!valid) return;
    onConfirm({ day, personA, personB });
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Swap Duties"
      footer={
        <div className="sheet-actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary" disabled={!valid || loading} onClick={handleConfirm}>
            {loading ? 'Swapping…' : 'Confirm Swap'}
          </button>
        </div>
      }
    >
      <label className="field-label">Day</label>
      <select className="text-input" value={day} onChange={(e) => { setDay(e.target.value); setPersonA(''); setPersonB(''); }}>
        {DAYS.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>

      <label className="field-label">Person A</label>
      <select className="text-input" value={personA} onChange={(e) => setPersonA(e.target.value)}>
        <option value="">Select person…</option>
        {allMembers.map((m) => (
          <option key={m._id} value={m._id} disabled={m._id === personB}>
            {m.name} — {roleLabel(roleOf(m._id))}
          </option>
        ))}
      </select>

      <label className="field-label">Person B</label>
      <select className="text-input" value={personB} onChange={(e) => setPersonB(e.target.value)}>
        <option value="">Select person…</option>
        {allMembers.map((m) => (
          <option key={m._id} value={m._id} disabled={m._id === personA}>
            {m.name} — {roleLabel(roleOf(m._id))}
          </option>
        ))}
      </select>

      {valid && a && b && (
        <div className="swap-preview">
          <div className="swap-row">
            <span className="swap-name">{a.name}</span>
            <span className="swap-role">{roleLabel(aRole)}</span>
            <span className="swap-arrow">→</span>
            <span className="swap-role">{roleLabel(bRole)}</span>
          </div>
          <div className="swap-row">
            <span className="swap-name">{b.name}</span>
            <span className="swap-role">{roleLabel(bRole)}</span>
            <span className="swap-arrow">→</span>
            <span className="swap-role">{roleLabel(aRole)}</span>
          </div>
        </div>
      )}
    </BottomSheet>
  );
}
