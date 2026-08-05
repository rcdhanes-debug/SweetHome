import { Pencil } from 'lucide-react';
import DutyBlock from './DutyBlock';
import { todayDayName } from '../utils/format';

export default function ChoreDayCard({ day, canEdit, onEdit, highlight }) {
  const isToday = day.day === todayDayName();
  return (
    <div className={`day-card ${highlight && isToday ? 'day-card--today' : ''}`}>
      <div className="day-card__head">
        <span className="day-card__name">{day.day.toUpperCase()}</span>
        {isToday && <span className="badge badge--today">TODAY</span>}
        {canEdit && (
          <button className="icon-btn icon-btn--sm" onClick={() => onEdit?.(day)} aria-label={`Edit ${day.day}`}>
            <Pencil size={15} />
          </button>
        )}
      </div>
      <div className="day-card__body" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', marginTop: '10px' }}>
        <DutyBlock role="cooking" members={day.cooking} />
        <DutyBlock role="cleaning" members={day.cleaning} />
        <DutyBlock role="homeClean" members={day.homeClean ? [day.homeClean] : []} />
      </div>
    </div>
  );
}
