import { useState, useEffect } from 'react';
import BottomSheet from './BottomSheet';
import { formatCurrency } from '../utils/format';
import { CONTRIBUTION_AMOUNT } from '../constants';

export default function AmountModal({ open, users = [], title, subtitle, defaultAmount, defaultUser, onConfirm, onCancel }) {
  const [amount, setAmount] = useState('');
  const [recordedBy, setRecordedBy] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setAmount(defaultAmount && defaultAmount > 0 ? String(defaultAmount) : String(CONTRIBUTION_AMOUNT));
      setRecordedBy(defaultUser || (users[0] ? users[0]._id : ''));
      setLoading(false);
    }
  }, [open, defaultAmount, defaultUser, users]);

  const amountNum = Number(amount);
  const valid = Number.isFinite(amountNum) && amountNum > 0 && amountNum <= 100000000;

  const confirm = () => {
    if (!valid || loading) return;
    setLoading(true);
    onConfirm?.({ amount: Math.round(amountNum * 100) / 100, recordedBy });
  };

  return (
    <BottomSheet open={open} onClose={onCancel} title={title || 'Confirm Contribution'}>
      {subtitle && <p className="sheet-subtitle">{subtitle}</p>}

      <label className="field-label">Amount received</label>
      <div className="amount-input">
        <span className="amount-input__prefix">₹</span>
        <input
          type="number"
          inputMode="decimal"
          min="1"
          step="1"
          placeholder="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          autoFocus
        />
        {valid && <span className="amount-input__preview">{formatCurrency(amountNum)}</span>}
      </div>

      {users && users.length > 0 && (
        <>
          <label className="field-label">Recorded By</label>
          <select className="select" value={recordedBy} onChange={(e) => setRecordedBy(e.target.value)}>
            {users.map((u) => (
              <option key={u._id} value={u._id}>
                {u.name}
              </option>
            ))}
          </select>
        </>
      )}

      <div className="notice notice--muted">
        Select the person recording this payment. No PIN is required.
      </div>

      <div className="sheet-actions">
        <button type="button" className="btn btn--ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="btn btn--primary" disabled={!valid || loading} onClick={confirm}>
          {loading ? (
            <>
              <span className="spinner" /> Saving…
            </>
          ) : (
            'Confirm Payment'
          )}
        </button>
      </div>
    </BottomSheet>
  );
}
