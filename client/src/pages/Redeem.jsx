import { useState } from 'react';
import { HandCoins, Plus, Send, CheckCircle2, RotateCcw, Trash2, Wallet, Smartphone } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import * as redeemApi from '../services/redeem';
import BottomSheet from '../components/BottomSheet';
import ConfirmModal from '../components/ConfirmModal';
import Skeleton from '../components/Skeleton';
import EmptyState from '../components/EmptyState';
import { formatCurrency, formatDate, formatTime } from '../utils/format';
import { HOUSEMATES, DEFAULT_UPI_IDS } from '../constants';
import * as expenseApi from '../services/expenses';

const UPI_PATTERN = /^[^\s@]+@[a-zA-Z]{2,}$/;

export default function Redeem() {
  const { redeems, users, loading, reloadRedeems, reloadExpenses } = useApp();
  const { isAdmin, session, runWithAuth } = useAuth();
  const toast = useToast();

  const [showForm, setShowForm] = useState(false);
  const [selectedName, setSelectedName] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [upiInput, setUpiInput] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [busy, setBusy] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [confirmPay, setConfirmPay] = useState(null); // redeem being closed
  const [payerName, setPayerName] = useState('');     // who is marking it paid

  const getUpiFor = (name) => {
    const u = users.find((x) => x.name === name);
    return u?.upiId || DEFAULT_UPI_IDS[name] || (name ? `${name.toLowerCase()}@okaxis` : '');
  };

  const handleCopyAndPay = (upiId, amount) => {
    navigator.clipboard.writeText(upiId);
    toast.show(`✓ UPI Copied! Amount: ₹${amount}`);
    if (/Android/i.test(navigator.userAgent)) {
      setTimeout(() => {
        window.location.href = 'intent://#Intent;package=com.google.android.apps.nbu.paisa.user;scheme=https;end';
      }, 500);
    }
  };

  const handleOpenForm = () => {
    const initName = session?.user?.name || (users[0]?.name || HOUSEMATES[0]);
    setSelectedName(initName);
    setUpiInput(getUpiFor(initName));
    setShowForm(true);
  };

  const handleSelectHousemate = (name) => {
    setSelectedName(name);
    setUpiInput(getUpiFor(name));
  };

  const resetForm = () => {
    setAmountInput('');
    setUpiInput('');
    setNoteInput('');
    setSelectedName('');
  };

  const run = async (opts, fn, okMsg) => {
    setBusy(opts.busy);
    try {
      await runWithAuth(opts.pin, (token) => fn(token));
      if (okMsg) toast.show(okMsg);
      await reloadRedeems();
    } catch (err) {
      if (err.message !== 'Cancelled') toast.show(err.message, 'error');
    } finally {
      setBusy('');
    }
  };

  const submitRedeem = async () => {
    const amount = Number(amountInput);
    const upiId = upiInput.trim();
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.show('Enter a valid amount', 'error');
      return;
    }
    if (!UPI_PATTERN.test(upiId)) {
      toast.show('Enter a valid UPI ID (e.g. name@okbank)', 'error');
      return;
    }

    setBusy('redeem-add');
    try {
      await redeemApi.createRedeem(session?.token || null, {
        amount,
        upiId,
        note: noteInput.trim(),
        userName: selectedName || session?.user?.name
      });
      toast.show('✓ Redeem request posted!');
      await reloadRedeems();
      setShowForm(false);
      resetForm();
    } catch (err) {
      toast.show(err.message || 'Failed to post redeem request', 'error');
    } finally {
      setBusy('');
    }
  };

  // Reopen — admin PIN required
  const reopenItem = async (item) => {
    setBusy(`redeem-${item._id}`);
    try {
      await runWithAuth(
        {
          title: 'Reopen Redeem Request',
          subtitle: `${item.createdBy?.name} • ${formatCurrency(item.amount)}`,
          adminOnly: true,
        },
        (token) => redeemApi.reopenRedeem(token, item._id)
      );
      toast.show('Redeem request reopened');
      await reloadRedeems();
      await reloadExpenses();
    } catch (err) {
      if (err.message !== 'Cancelled') toast.show(err.message, 'error');
    } finally {
      setBusy('');
    }
  };

  // Close — no PIN, just name selection
  const handleConfirmPay = async () => {
    if (!payerName) { toast.show('Please select your name', 'error'); return; }
    const r = confirmPay;
    setConfirmPay(null);
    setBusy(`redeem-${r._id}`);
    try {
      await redeemApi.closeRedeem(payerName, r._id);
      toast.show('✓ Marked paid — expense added & balance updated');
      await reloadRedeems();
      await reloadExpenses();
    } catch (err) {
      toast.show(err?.response?.data?.message || err.message, 'error');
    } finally {
      setBusy('');
      setPayerName('');
    }
  };

  const confirmRemove = async () => {
    const target = confirmDelete;
    setConfirmDelete(null);
    await run({ busy: `del-${target._id}`, pin: { title: 'Delete Redeem Request', subtitle: `${target.createdBy?.name} • ${formatCurrency(target.amount)}`, adminOnly: true } }, (t) => redeemApi.deleteRedeem(t, target._id), '✓ Removed');
  };

  const open = redeems.filter((r) => !r.closed);
  const closed = redeems.filter((r) => r.closed);
  const pendingTotal = open.reduce((s, r) => s + r.amount, 0);
  const housemateList = users.length > 0 ? users.map((u) => u.name) : HOUSEMATES;

  return (
    <div className="page">
      <section className="redeem-hero">
        <div className="redeem-hero__label">
          <HandCoins size={15} /> Pending Redeem Requests
        </div>
        <div className="redeem-hero__amount">{formatCurrency(pendingTotal)}</div>
        <div className="redeem-hero__sub">to be sent to housemates</div>
      </section>

      <section className="redeem-stats">
        <div className="redeem-stat">
          <div className="redeem-stat__value redeem-stat__value--open">{open.length}</div>
          <div className="redeem-stat__label">Open</div>
        </div>
        <div className="redeem-stat">
          <div className="redeem-stat__value redeem-stat__value--closed">{closed.length}</div>
          <div className="redeem-stat__label">Settled</div>
        </div>
        <div className="redeem-stat">
          <div className="redeem-stat__value redeem-stat__value--total">{redeems.length}</div>
          <div className="redeem-stat__label">Total</div>
        </div>
      </section>

      <section className="card">
        <div className="card__head">
          <h3>
            <Wallet size={16} /> Spend money for the house? Raise a redeem
          </h3>
        </div>
        <p className="muted card__hint">
          Post the amount you spent with your pre-stored UPI ID. Whoever handles the house account settles it and closes the request.
        </p>
        <button type="button" className="btn btn--primary btn--block" onClick={handleOpenForm}>
          <Plus size={16} /> Raise Redeem Request
        </button>
      </section>

      <h2 className="section-title">Open Requests</h2>
      {loading.redeems ? (
        <Skeleton height={140} />
      ) : open.length === 0 ? (
        <EmptyState icon="💸" title="Nothing pending" subtitle="No open redeem requests. Spent money for the house? Raise one." />
      ) : (
        <div className="nb-list card">
          {open.map((r) => (
            <div key={r._id} className="nb-row">
              <div className="nb-row__icon">
                <HandCoins size={18} />
              </div>
              <div className="nb-row__body">
                <div className="nb-row__text">
                  {formatCurrency(r.amount)}
                  <span className="badge badge--today">Open</span>
                </div>
                <div className="redeem-upi">{r.upiId}</div>
                {r.note && <div className="nb-row__desc">{r.note}</div>}
                <div className="nb-row__meta">
                  Raised by {r.createdBy?.name || '—'} • {formatDate(r.createdAt)} • {formatTime(r.createdAt)}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end', flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() => handleCopyAndPay(r.upiId, r.amount)}
                  className="btn btn--primary btn--sm"
                  style={{ gap: '5px' }}
                  title={`Pay ₹${r.amount} to ${r.upiId}`}
                >
                  <Smartphone size={13} /> Copy & Pay
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  disabled={busy === `redeem-${r._id}`}
                  onClick={() => setConfirmPay(r)}
                  title="Mark as settled"
                >
                  <CheckCircle2 size={13} /> Close
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <h2 className="section-title">Settled</h2>
      {loading.redeems ? (
        <Skeleton height={120} />
      ) : closed.length === 0 ? (
        <EmptyState icon="✅" title="Nothing settled yet" subtitle="Closed redeem requests will show up here." />
      ) : (
        <div className="nb-list card">
          {closed.map((r) => (
            <div key={r._id} className="nb-row">
              <div className="nb-row__icon">
                <CheckCircle2 size={18} />
              </div>
              <div className="nb-row__body">
                <div className="nb-row__text nb-row__text--muted">
                  {formatCurrency(r.amount)}
                  <span className="badge badge--protected">Settled</span>
                </div>
                <div className="redeem-upi redeem-upi--muted">{r.upiId}</div>
                {r.note && <div className="nb-row__desc">{r.note}</div>}
                <div className="nb-row__meta">
                  {r.createdBy?.name || '—'} • settled by {r.closedByName || r.closedBy?.name || '—'} on {formatDate(r.closedAt)}
                </div>
              </div>
              <div className="nb-row__actions">
                  <button type="button" className="btn btn--ghost btn--sm" disabled={busy === `redeem-${r._id}`} onClick={() => reopenItem(r)} title="Reopen">
                    <RotateCcw size={13} /> Reopen
                  </button>
                  {isAdmin && (
                  <button type="button" className="icon-btn icon-btn--sm" onClick={() => setConfirmDelete(r)} title="Remove">
                    <Trash2 size={15} />
                  </button>
                  )}
                </div>
            </div>
          ))}
        </div>
      )}

      <BottomSheet open={showForm} onClose={() => setShowForm(false)} title="Raise Redeem Request" maxWidth={520}>
        <p className="sheet-subtitle">Money spent for the house, sent to the pre-stored UPI handle after approval.</p>

        <label className="field-label">Housemate Name</label>
        <div className="name-grid" style={{ marginBottom: '16px' }}>
          {housemateList.map((name) => (
            <button
              key={name}
              type="button"
              className={`name-chip ${selectedName === name ? 'name-chip--active' : ''}`}
              onClick={() => handleSelectHousemate(name)}
            >
              {name}
            </button>
          ))}
        </div>

        <label className="field-label">
          UPI ID {selectedName && <span className="muted" style={{ fontWeight: 'normal', fontSize: '12px' }}>(pre-stored for {selectedName})</span>}
        </label>
        <input
          className="text-input"
          placeholder="e.g. name@okbank"
          value={upiInput}
          maxLength={120}
          onChange={(e) => setUpiInput(e.target.value)}
        />

        <label className="field-label">Amount spent</label>
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

        <label className="field-label">Note (optional)</label>
        <input
          className="text-input"
          placeholder="e.g. Groceries for the week"
          value={noteInput}
          maxLength={300}
          onChange={(e) => setNoteInput(e.target.value)}
        />

        <div className="notice notice--muted">
          The request stays open until someone handling the account sends the amount and closes it.
        </div>

        <div className="sheet-actions">
          <button type="button" className="btn btn--ghost" onClick={() => setShowForm(false)}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary" disabled={busy === 'redeem-add'} onClick={submitRedeem}>
            <Send size={15} /> {busy === 'redeem-add' ? 'Posting…' : 'Post Request'}
          </button>
        </div>
      </BottomSheet>

      <ConfirmModal
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        onConfirm={confirmRemove}
        loading={busy === `del-${confirmDelete?._id}`}
        title="Delete Redeem Request"
        message={`Delete the ${formatCurrency(confirmDelete?.amount || 0)} request from ${confirmDelete?.createdBy?.name || 'this housemate'}? This cannot be undone.`}
        confirmLabel="Delete"
        danger
      />

      {/* "Mark as Paid" — name picker only, no PIN */}
      <BottomSheet
        open={Boolean(confirmPay)}
        onClose={() => { setConfirmPay(null); setPayerName(''); }}
        title="Who paid this? 💸"
      >
        <p className="sheet-subtitle">
          {formatCurrency(confirmPay?.amount || 0)} to {confirmPay?.createdBy?.name || 'housemate'} ({confirmPay?.upiId || '—'})
        </p>
        <p className="muted" style={{ fontSize: '13px', margin: '4px 0 12px' }}>
          Select your name — this will close the request and add it as an expense.
        </p>
        <div className="field-label">Select your name</div>
        <div className="name-grid" style={{ marginBottom: '16px' }}>
          {housemateList.map((name) => (
            <button
              key={name}
              type="button"
              className={`name-chip ${payerName === name ? 'name-chip--active' : ''}`}
              onClick={() => setPayerName(name)}
            >
              {name}
            </button>
          ))}
        </div>
        <div className="sheet-actions">
          <button type="button" className="btn btn--ghost" onClick={() => { setConfirmPay(null); setPayerName(''); }}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn--primary"
            disabled={!payerName || busy === `redeem-${confirmPay?._id}`}
            onClick={handleConfirmPay}
          >
            {busy === `redeem-${confirmPay?._id}` ? <><span className="spinner" /> Saving…</> : '✓ Mark as Paid'}
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
