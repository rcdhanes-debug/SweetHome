import { Check, Clock } from 'lucide-react';
import Avatar from './Avatar';
import { formatCurrency, formatDate, formatTime } from '../utils/format';

export default function PaymentCard({ payment, isAdmin, onMarkPaid, onTogglePending, busy }) {
  const { user, paid, amount, targetAmount = 6000, dueAmount, status, paidAt, recordedBy } = payment;
  const isPartial = status === 'partial' || (!paid && amount > 0);
  const isPaid = paid || status === 'paid';
  const remaining = dueAmount ?? Math.max(0, targetAmount - (amount || 0));

  return (
    <div className={`pay-card ${isPaid ? 'pay-card--paid' : isPartial ? 'pay-card--partial' : 'pay-card--pending'}`}>
      <div className="pay-card__top">
        <Avatar user={user} name={user?.name} />
        <div className="pay-card__who">
          <div className="pay-card__name">{user?.name}</div>
          {user?.role === 'admin' && <span className="badge badge--admin">Admin</span>}
        </div>
        <div className="pay-card__status">
          {isPaid ? (
            <span className="status-pill status-pill--paid">
              <Check size={14} /> Paid
            </span>
          ) : isPartial ? (
            <span className="status-pill status-pill--partial" style={{ background: '#f59e0b20', color: '#d97706', border: '1px solid #f59e0b40' }}>
              <Clock size={14} /> Partial
            </span>
          ) : (
            <span className="status-pill status-pill--pending">
              <Clock size={14} /> Pending
            </span>
          )}
        </div>
      </div>

      <div className={`pay-card__amount ${isPaid ? '' : 'pay-card__amount--pending'}`}>
        {isPaid ? (
          formatCurrency(amount)
        ) : isPartial ? (
          <span>
            {formatCurrency(amount)} paid <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--muted)' }}>• {formatCurrency(remaining)} due</span>
          </span>
        ) : (
          'Yet to pay'
        )}
      </div>

      <div className="pay-card__meta">
        {paidAt ? (
          <>
            <span>{formatDate(paidAt)}</span>
            <span>{formatTime(paidAt)}</span>
            {recordedBy && <span className="pay-card__by">by {recordedBy.name}</span>}
          </>
        ) : (
          <span>Not yet paid</span>
        )}
      </div>

      {!isPaid && (
        <button
          type="button"
          className="btn btn--primary btn--block"
          disabled={busy}
          onClick={() => onMarkPaid?.(payment)}
        >
          {isPartial ? `Add Payment (₹${remaining} due)` : 'Mark as Paid'}
        </button>
      )}

      {isAdmin && (amount > 0 || isPaid) && (
        <button
          type="button"
          className="btn btn--ghost btn--block"
          style={{ marginTop: '6px' }}
          disabled={busy}
          onClick={() => onTogglePending?.(payment)}
        >
          Reset to Unpaid
        </button>
      )}
    </div>
  );
}
