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
      <div className="day-card__body">
        <DutyBlock role="morningCooking" members={day.morningCooking} food={day.morningFood} />
        {day.nightCooking && day.nightCooking.length > 0 && (
          <DutyBlock role="nightCooking" members={day.nightCooking} food={day.nightFood} />
        )}
        <DutyBlock role="cleaning" members={day.cleaning} />
      </div>
    </div>
  );
}
