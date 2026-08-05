import { useState } from 'react';
import { ShoppingBasket, Zap, SprayCan, Wifi, Receipt } from 'lucide-react';
import { CATEGORIES, CATEGORY_META } from '../constants';
import { todayISTDateString, formatCurrency } from '../utils/format';

export default function ExpenseForm({ users, initial, submitting, onSubmit, onCancel }) {
  const [amount, setAmount] = useState(initial?.amount ? String(initial.amount) : '');
  const [category, setCategory] = useState(initial?.category || CATEGORIES[0]);
  const [description, setDescription] = useState(initial?.description || '');
  const [date, setDate] = useState(initial?.expenseDate ? initial.expenseDate.slice(0, 10) : todayISTDateString());
  const [paidBy, setPaidBy] = useState(initial?.paidBy?._id || '');

  const amountNum = Number(amount);
  const valid = amountNum > 0 && category && date && paidBy;

  const submit = (e) => {
    e.preventDefault();
    if (!valid || submitting) return;
    onSubmit({
      amount: amountNum,
      category,
      description: description.trim(),
      expenseDate: date,
      paidBy
    });
  };

  return (
    <form className="expense-form" onSubmit={submit}>
      <label className="field-label">Amount</label>
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
        {amountNum > 0 && <span className="amount-input__preview">{formatCurrency(amountNum)}</span>}
      </div>

      <label className="field-label">Category</label>
      <div className="chip-row">
        {CATEGORIES.map((c) => {
          const meta = CATEGORY_META[c];
          const isActive = category === c;
          const ICONS = { ShoppingBasket, Zap, SprayCan, Wifi, Receipt };
          const Icon = ICONS[meta?.icon];
          return (
            <button
              key={c}
              type="button"
              className="cat-chip"
              onClick={() => setCategory(c)}
              style={isActive ? {
                background: meta?.bg,
                borderColor: meta?.color,
                color: meta?.color,
                boxShadow: `0 0 0 2px ${meta?.color}33, 0 4px 16px ${meta?.color}40`,
                transform: 'scale(1.06)',
              } : {}}
            >
              {Icon && <Icon size={14} />}
              {c}
            </button>
          );
        })}
      </div>

      <label className="field-label" htmlFor="exp-desc">
        Description <span className="muted">(optional)</span>
      </label>
      <input
        id="exp-desc"
        className="text-input"
        type="text"
        placeholder="Vegetables and groceries"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />

      <label className="field-label" htmlFor="exp-date">
        Date
      </label>
      <input
        id="exp-date"
        className="text-input"
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
      />

      <label className="field-label">Paid By</label>
      <select className="text-input" value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
        <option value="">Select a housemate…</option>
        {users.map((u) => (
          <option key={u._id} value={u._id}>
            {u.name}
          </option>
        ))}
      </select>

      <div className="notice notice--muted">
        A PIN check is required to confirm this expense.
      </div>

      <div className="sheet-actions">
        <button type="button" className="btn btn--ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn--primary" disabled={!valid || submitting}>
          {submitting ? 'Saving…' : initial ? 'Save Changes' : 'Add Expense'}
        </button>
      </div>
    </form>
  );
}
