import { Check, Clock } from 'lucide-react';
import Avatar from './Avatar';
import { formatCurrency, formatDate, formatTime } from '../utils/format';

export default function PaymentCard({ payment, isAdmin, onMarkPaid, onTogglePending, busy }) {
  const { user, paid, amount, paidAt, recordedBy } = payment;

  return (
    <div className={`pay-card ${paid ? 'pay-card--paid' : 'pay-card--pending'}`}>
      <div className="pay-card__top">
        <Avatar user={user} name={user?.name} />
        <div className="pay-card__who">
          <div className="pay-card__name">{user?.name}</div>
          {user?.role === 'admin' && <span className="badge badge--admin">Admin</span>}
        </div>
        <div className="pay-card__status">
          {paid ? (
            <span className="status-pill status-pill--paid">
              <Check size={14} /> Paid
            </span>
          ) : (
            <span className="status-pill status-pill--pending">
              <Clock size={14} /> Pending
            </span>
          )}
        </div>
      </div>

      <div className={`pay-card__amount ${paid ? '' : 'pay-card__amount--pending'}`}>
        {paid ? formatCurrency(amount) : 'Yet to pay'}
      </div>

      <div className="pay-card__meta">
        {paid ? (
          <>
            <span>{formatDate(paidAt)}</span>
            <span>{formatTime(paidAt)}</span>
            {recordedBy && <span className="pay-card__by">by {recordedBy.name}</span>}
          </>
        ) : (
          <span>Not yet paid</span>
        )}
      </div>

      {!paid && isAdmin && (
        <button
          type="button"
          className="btn btn--primary btn--block"
          disabled={busy}
          onClick={() => onMarkPaid?.(payment)}
        >
          Mark as Paid
        </button>
      )}

      {paid && isAdmin && (
        <button
          type="button"
          className="btn btn--ghost btn--block"
          disabled={busy}
          onClick={() => onTogglePending?.(payment)}
        >
          Mark as Pending
        </button>
      )}
    </div>
  );
}
