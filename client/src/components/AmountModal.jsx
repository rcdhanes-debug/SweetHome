import { useState, useEffect } from 'react';
import BottomSheet from './BottomSheet';
import { formatCurrency } from '../utils/format';
import { CONTRIBUTION_AMOUNT } from '../constants';

export default function AmountModal({ open, title, subtitle, defaultAmount, onConfirm, onCancel }) {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setAmount(defaultAmount && defaultAmount > 0 ? String(defaultAmount) : String(CONTRIBUTION_AMOUNT));
      setLoading(false);
    }
  }, [open, defaultAmount]);

  const amountNum = Number(amount);
  const valid = Number.isFinite(amountNum) && amountNum > 0 && amountNum <= 100000000;

  const confirm = () => {
    if (!valid || loading) return;
    setLoading(true);
    onConfirm?.(Math.round(amountNum * 100) / 100);
  };

  return (
    <BottomSheet open={open} onClose={onCancel} title={title || 'Payment Amount'}>
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

      <div className="notice notice--muted">
        Default is ₹{CONTRIBUTION_AMOUNT.toLocaleString('en-IN')}. Enter the actual amount received if it differs.
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
            'Continue'
          )}
        </button>
      </div>
    </BottomSheet>
  );
}
