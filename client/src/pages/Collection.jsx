import { useState } from 'react';
import { Link } from 'react-router-dom';
import { RotateCcw, CalendarClock, ChevronDown, Printer, FileText, SlidersHorizontal, Coins } from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import * as fundingApi from '../services/funding';
import ProgressBar from '../components/ProgressBar';
import PaymentCard from '../components/PaymentCard';
import Skeleton from '../components/Skeleton';
import ConfirmModal from '../components/ConfirmModal';
import AmountModal from '../components/AmountModal';
import BottomSheet from '../components/BottomSheet';
import Confetti from '../components/Confetti';
import { formatCurrency, monthLabel, deadlineInfo } from '../utils/format';

export default function Collection() {
  const { funding, history, users, loading, reloadFunding } = useApp();
  const { isAdmin, runWithAuth } = useAuth();
  const toast = useToast();
  const reduced = useReducedMotion();
  const [busyId, setBusyId] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [payTarget, setPayTarget] = useState(null);
  const [showAmount, setShowAmount] = useState(false);
  const [amountInput, setAmountInput] = useState('');
  const [monthSelect, setMonthSelect] = useState('');
  const [busyAmount, setBusyAmount] = useState(false);
  const [showRolloverSheet, setShowRolloverSheet] = useState(false);
  const [rolloverInput, setRolloverInput] = useState('');
  const [busyRollover, setBusyRollover] = useState(false);

  if (loading.funding || !funding) {
    return (
      <div className="page">
        <div className="stack">
          <Skeleton height={150} />
          <div className="grid-2">
            <Skeleton height={110} />
            <Skeleton height={110} />
          </div>
          <Skeleton height={220} />
        </div>
      </div>
    );
  }

  const pct = Math.round((funding.totalCollected / funding.targetAmount) * 100);
  const deadline = funding.deadline || deadlineInfo();

  const monthOptions = (() => {
    const [y, m] = funding.month.split('-').map(Number);
    const opts = [];
    for (let i = 0; i < 4; i += 1) {
      const d = new Date(Date.UTC(y, m - 1 + i, 1));
      opts.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
    }
    return opts;
  })();

  const openAmountSheet = () => {
    setMonthSelect(funding.month);
    setAmountInput(String(funding.contributionAmount || 0));
    setShowAmount(true);
  };

  const openRolloverSheet = () => {
    setRolloverInput(String(funding.rolloverBalance || 0));
    setShowRolloverSheet(true);
  };

  const saveRollover = async (auto = false) => {
    const n = Number(rolloverInput);
    if (!auto && (!Number.isFinite(n) || n < 0)) {
      toast.show('Enter a valid rollover amount', 'error');
      return;
    }
    setBusyRollover(true);
    try {
      await runWithAuth(
        {
          title: 'Set Rollover Balance',
          subtitle: auto ? 'Reset to auto-calculated rollover' : `₹${formatCurrency(n)} rollover balance`,
          adminOnly: true
        },
        async (token) => {
          await fundingApi.setRolloverAmount(token, funding.month, n, auto);
        }
      );
      toast.show(auto ? '✓ Rollover reset to auto' : '✓ Rollover balance updated');
      setShowRolloverSheet(false);
      await reloadFunding();
    } catch (err) {
      if (err.message !== 'Cancelled') toast.show(err.message, 'error');
    } finally {
      setBusyRollover(false);
    }
  };

  const saveAmount = async () => {
    const n = Number(amountInput);
    if (!Number.isFinite(n) || n <= 0) {
      toast.show('Enter a valid amount', 'error');
      return;
    }
    setBusyAmount(true);
    try {
      await runWithAuth(
        { title: 'Change Contribution Amount', subtitle: `${formatCurrency(n)} per person for ${monthLabel(monthSelect)}`, adminOnly: true },
        async (token) => {
          await fundingApi.setContributionAmount(token, monthSelect, n);
        }
      );
      toast.show('✓ Contribution amount updated');
      setShowAmount(false);
      await reloadFunding();
    } catch (err) {
      if (err.message !== 'Cancelled') toast.show(err.message, 'error');
    } finally {
      setBusyAmount(false);
    }
  };

  const markPaid = async (payment) => {
    setPayTarget({ payment });
  };

  const confirmPayAmount = async ({ amount, recordedBy }) => {
    const { payment } = payTarget;
    setPayTarget(null);
    setBusyId(payment.user._id);
    try {
      await fundingApi.pay(payment.user._id, amount, recordedBy);
      toast.show(`✓ ${formatCurrency(amount)} marked as paid`);
      setCelebrate(true);
      await reloadFunding();
    } catch (err) {
      toast.show(err.message || 'Failed to record payment', 'error');
    } finally {
      setBusyId('');
    }
  };

  const togglePending = async (payment) => {
    setBusyId(payment.user._id);
    try {
      await runWithAuth(
        { title: 'Revert Payment', subtitle: `Mark ${payment.user.name} as pending?`, adminOnly: true },
        async (token) => {
          await fundingApi.setStatus(token, payment.user._id, false);
        }
      );
      toast.show('Payment reverted to pending');
      await reloadFunding();
    } catch (err) {
      if (err.message !== 'Cancelled') toast.show(err.message, 'error');
    } finally {
      setBusyId('');
    }
  };

  const resetMonth = async () => {
    setConfirmReset(false);
    try {
      await runWithAuth({ title: 'Reset Monthly Funding', subtitle: 'All payments will be set to pending.', adminOnly: true }, async (token) => {
        await fundingApi.resetMonth(token);
      });
      toast.show('Monthly funding reset');
      await reloadFunding();
    } catch (err) {
      if (err.message !== 'Cancelled') toast.show(err.message, 'error');
    }
  };

  return (
    <div className="page">
      {celebrate && <Confetti onDone={() => setCelebrate(false)} />}
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
        <div style={{ marginTop: '12px', fontSize: '13px', color: 'var(--amber)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>✨ Rollover Balance: {formatCurrency(funding.rolloverBalance || 0)}</span>
          {funding.isCustomRollover && <span className="badge badge--admin">Admin Override</span>}
        </div>
      </section>

      <section className={`deadline-card ${deadline.passed ? 'deadline-card--danger' : ''}`}>
        <CalendarClock size={20} />
        <div>
          <div className="deadline-card__label">Deadline — 5th of month</div>
          <div className="deadline-card__text">{deadline.text}</div>
        </div>
      </section>

      <section className="dues-actions">
        <Link to={`/print?month=${funding.month}`} className="btn btn--ghost">
          <Printer size={16} /> Monthly Report (PDF)
        </Link>
        <Link to="/dues" className="btn btn--ghost">
          <FileText size={16} /> Dues & Payoff
        </Link>
      </section>

      {isAdmin && (
        <div className="admin-fund-actions">
          <button type="button" className="btn btn--ghost" onClick={openAmountSheet}>
            <SlidersHorizontal size={16} /> Contribution ₹{formatCurrency(funding.contributionAmount)}/person
          </button>
          <button type="button" className="btn btn--ghost" onClick={openRolloverSheet}>
            <Coins size={16} /> Edit Rollover (₹{formatCurrency(funding.rolloverBalance)})
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => setConfirmReset(true)}>
            <RotateCcw size={16} /> Reset Monthly Funding
          </button>
        </div>
      )}

      <h2 className="section-title">Housemate Payments</h2>
      <div className="pay-grid">
        {funding.payments.map((p) => (
          <PaymentCard
            key={p.user._id}
            payment={p}
            isAdmin={isAdmin}
            busy={busyId === p.user._id}
            onMarkPaid={markPaid}
            onTogglePending={togglePending}
          />
        ))}
      </div>

      {history.length > 1 && (
        <section className="card">
          <button type="button" className="card__head card__head--btn" onClick={() => setShowHistory((v) => !v)}>
            <h3>Previous Months</h3>
            <ChevronDown size={18} className={showHistory ? 'rotated' : ''} />
          </button>
          <AnimatePresence initial={false}>
            {showHistory && (
              <motion.div
                key="history"
                className="expand"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={reduced ? { duration: 0.01 } : { type: 'spring', stiffness: 260, damping: 30 }}
              >
                <div className="history-list">
                  {history.map((h) => (
                    <div key={h.month} className="history-row">
                      <div>
                        <div className="history-row__month">{monthLabel(h.month)}</div>
                        <div className="history-row__sub">
                          {h.paidCount}/{h.paidCount + h.pendingCount} paid
                        </div>
                      </div>
                      <div className="history-row__amt">{formatCurrency(h.totalCollected)}</div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      )}

      <ConfirmModal
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={resetMonth}
        title="Reset Monthly Funding"
        message="Reset all contributions to pending for the current month? This cannot be undone."
        confirmLabel="Reset"
        danger
      />

      <AmountModal
        open={Boolean(payTarget)}
        users={users}
        title="Confirm Contribution"
        subtitle={payTarget ? `${payTarget.payment.user.name} • Payment received` : undefined}
        defaultAmount={payTarget?.payment.amount}
        defaultUser={payTarget?.payment.user._id}
        onConfirm={confirmPayAmount}
        onCancel={() => setPayTarget(null)}
      />

      <BottomSheet open={showAmount} onClose={() => setShowAmount(false)} title="Set Monthly Contribution" maxWidth={520}>
        <p className="sheet-subtitle">Contribution per person for the selected month. Each month can have its own amount.</p>

        <label className="field-label">Month</label>
        <select className="select" value={monthSelect} onChange={(e) => setMonthSelect(e.target.value)}>
          {monthOptions.map((m) => (
            <option key={m} value={m}>
              {monthLabel(m)}
            </option>
          ))}
        </select>

        <label className="field-label">Amount per person</label>
        <div className="amount-input">
          <span className="amount-input__prefix">₹</span>
          <input
            type="number"
            inputMode="decimal"
            min="1"
            step="1"
            placeholder="0"
            value={amountInput}
            onChange={(e) => setAmountInput(e.target.value)}
          />
        </div>

        <div className="notice notice--muted">
          Pending members will be set to this amount for the chosen month. Already-paid amounts stay unchanged.
        </div>

        <div className="sheet-actions">
          <button type="button" className="btn btn--ghost" onClick={() => setShowAmount(false)}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary" disabled={busyAmount} onClick={saveAmount}>
            {busyAmount ? 'Saving…' : 'Save Amount'}
          </button>
        </div>
      </BottomSheet>

      <BottomSheet open={showRolloverSheet} onClose={() => setShowRolloverSheet(false)} title="Set Rollover Balance" maxWidth={520}>
        <p className="sheet-subtitle">
          Carried-over unspent money from previous months. By default, this is calculated automatically from leftover funds.
        </p>

        <label className="field-label">Custom Rollover Amount</label>
        <div className="amount-input">
          <span className="amount-input__prefix">₹</span>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="1"
            placeholder="0"
            value={rolloverInput}
            onChange={(e) => setRolloverInput(e.target.value)}
          />
        </div>

        <div className="notice notice--muted">
          Current status: {funding?.isCustomRollover ? 'Custom Admin Override' : 'Auto-Calculated from previous months'}
        </div>

        <div className="sheet-actions">
          <button type="button" className="btn btn--ghost" disabled={busyRollover} onClick={() => saveRollover(true)}>
            Reset to Auto
          </button>
          <button type="button" className="btn btn--primary" disabled={busyRollover} onClick={() => saveRollover(false)}>
            {busyRollover ? 'Saving…' : 'Save Rollover'}
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
