import { useNavigate } from 'react-router-dom';
import { Wallet, CheckCircle2, Clock, Printer, ArrowRight, CalendarClock, PiggyBank } from 'lucide-react';
import { useApp } from '../context/AppContext';
import Skeleton from '../components/Skeleton';
import Avatar from '../components/Avatar';
import ProgressBar from '../components/ProgressBar';
import { formatCurrency, formatDate, formatTime, monthLabel, deadlineInfo } from '../utils/format';

export default function Dues() {
  const { funding, loading } = useApp();
  const navigate = useNavigate();

  if (loading.funding || !funding) {
    return (
      <div className="page">
        <div className="stack">
          <Skeleton height={160} />
          <Skeleton height={260} />
        </div>
      </div>
    );
  }

  const pct = Math.round((funding.totalCollected / funding.targetAmount) * 100);
  const pending = funding.payments.filter((p) => !p.paid);
  const deadline = funding.deadline || deadlineInfo();

  const openReport = () => navigate(`/print?month=${funding.month}`);

  return (
    <div className="page">
      <section className="fund-hero">
        <div className="fund-hero__month">{funding.monthLabel}</div>
        <div className="fund-hero__amount">
          {formatCurrency(funding.totalCollected)} <span className="fund-hero__target">/ {formatCurrency(funding.targetAmount)}</span>
        </div>
        <ProgressBar value={funding.totalCollected} max={funding.targetAmount} height={14} />
        <div className="fund-hero__foot">
          <span className="fund-hero__pct">{pct}% Collected</span>
          <span className="fund-hero__count">
            {funding.paidCount} / {funding.paidCount + funding.pendingCount} paid
          </span>
        </div>
      </section>

      <section className="dues-actions">
        <button type="button" className="btn btn--primary" onClick={openReport}>
          <Printer size={16} /> Monthly Report (PDF)
        </button>
        <button type="button" className="btn btn--ghost" onClick={() => navigate('/collection')}>
          <Wallet size={16} /> Manage Payments <ArrowRight size={14} />
        </button>
      </section>

      <section className="grid-3">
        <div className="stat-card">
          <span className="stat-card__icon" style={{ background: 'var(--accent-bg)' }}>
            <PiggyBank size={18} />
          </span>
          <div className="stat-card__label">Collected</div>
          <div className="stat-card__value">{formatCurrency(funding.totalCollected)}</div>
        </div>
        <div className="stat-card">
          <span className="stat-card__icon" style={{ background: 'var(--green-bg)' }}>
            <Wallet size={18} />
          </span>
          <div className="stat-card__label">Spent</div>
          <div className="stat-card__value">{formatCurrency(funding.totalSpent)}</div>
        </div>
        <div className="stat-card">
          <span className="stat-card__icon" style={{ background: 'var(--amber-bg)' }}>
            <CheckCircle2 size={18} />
          </span>
          <div className="stat-card__label">Balance</div>
          <div className="stat-card__value">{formatCurrency(funding.balance)}</div>
        </div>
      </section>

      <section className={`deadline-card ${funding.paidCount === funding.payments.length && funding.pendingCount === 0 && funding.partialCount === 0 ? 'deadline-card--success' : (deadline.passed ? 'deadline-card--danger' : '')}`}>
        <CalendarClock size={20} />
        <div>
          <div className="deadline-card__label">
            {funding.paidCount === funding.payments.length && funding.pendingCount === 0 && funding.partialCount === 0 ? 'Monthly Collection Complete' : 'Deadline — 5th of month'}
          </div>
          <div className="deadline-card__text">
            {funding.paidCount === funding.payments.length && funding.pendingCount === 0 && funding.partialCount === 0 ? '🎉 All 9 housemates have paid!' : deadline.text}
          </div>
        </div>
      </section>

      <h2 className="section-title">Settlement Status</h2>
      <div className="dues-list">
        {funding.payments.map((p) => (
          <div key={p.user._id} className={`due-row ${p.paid ? 'due-row--paid' : 'due-row--pending'}`}>
            <Avatar user={p.user} name={p.user?.name} />
            <div className="due-row__who">
              <div className="due-row__name">{p.user?.name}</div>
              <div className="due-row__meta">
                {p.paid ? (
                  <>
                    {formatDate(p.paidAt)} • {formatTime(p.paidAt)}
                    {p.recordedBy && <span className="due-row__by"> by {p.recordedBy.name}</span>}
                  </>
                ) : (
                  'Not yet paid'
                )}
              </div>
            </div>
            <div className="due-row__right">
              <div className="due-row__amt">{p.paid ? formatCurrency(p.amount) : '—'}</div>
              <span className={`status-pill ${p.paid ? 'status-pill--paid' : 'status-pill--pending'}`}>
                {p.paid ? <CheckCircle2 size={14} /> : <Clock size={14} />}
                {p.paid ? 'Paid' : 'Pending'}
              </span>
            </div>
          </div>
        ))}
      </div>

      {pending.length > 0 && (
        <p className="dues-hint">
          {pending.map((p) => p.user?.name).join(', ')} {pending.length === 1 ? 'is' : 'are'} yet to contribute for{' '}
          {monthLabel(funding.month)}.
        </p>
      )}
    </div>
  );
}
