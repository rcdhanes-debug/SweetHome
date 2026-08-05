import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import * as expenseApi from '../services/expenses';
import StatCard from '../components/StatCard';
import ExpenseItem from '../components/ExpenseItem';
import ExpenseForm from '../components/ExpenseForm';
import BottomSheet from '../components/BottomSheet';
import ConfirmModal from '../components/ConfirmModal';
import Confetti from '../components/Confetti';
import Skeleton from '../components/Skeleton';
import EmptyState from '../components/EmptyState';
import { formatCurrency } from '../utils/format';

export default function Expenses() {
  const { funding, users, expenses, loading, reloadExpenses } = useApp();
  const { session, runWithAuth } = useAuth();
  const toast = useToast();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [celebrate, setCelebrate] = useState(false);

  const totalSpent = expenses.reduce((s, e) => s + e.amount, 0);
  const collected = funding?.totalCollected || 0;
  const balance = collected - totalSpent;

  const openCreate = () => {
    setEditing(null);
    setSheetOpen(true);
  };

  const openEdit = (expense) => {
    setEditing(expense);
    setSheetOpen(true);
  };

  const handleSubmit = async (data) => {
    setSubmitting(true);
    try {
      const paidByUser = users.find((u) => u._id === data.paidBy);
      if (editing) {
        await runWithAuth(
          {
            title: 'Edit Expense',
            subtitle: `${formatCurrency(data.amount)} • ${data.category}`,
            adminOnly: true,
            defaultName: paidByUser?.name || session?.user?.name
          },
          async (token) => {
            await expenseApi.update(token, editing._id, data);
          }
        );
        toast.show('✓ Expense updated');
      } else {
        await expenseApi.create(data);
        toast.show('✓ Expense added');
      }
      setSheetOpen(false);
      setEditing(null);
      setCelebrate(true);
      await reloadExpenses();
    } catch (err) {
      if (err.message !== 'Cancelled') toast.show(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    const target = deleting;
    setDeleting(null);
    try {
      await runWithAuth(
        {
          title: 'Delete Expense',
          subtitle: `${target.category} • ${formatCurrency(target.amount)}`,
          adminOnly: true,
          defaultName: target.paidBy?.name || session?.user?.name
        },
        async (token) => {
          await expenseApi.remove(token, target._id);
        }
      );
      toast.show('✓ Expense deleted');
      await reloadExpenses();
    } catch (err) {
      if (err.message !== 'Cancelled') toast.show(err.message, 'error');
    }
  };

  return (
    <div className="page">
      {celebrate && <Confetti onDone={() => setCelebrate(false)} />}
      <div className="balance-grid">
        <StatCard label="Collected" value={formatCurrency(collected)} accent="green" />
        <StatCard label="Spent" value={formatCurrency(totalSpent)} accent="red" />
        <StatCard label="Available" value={formatCurrency(balance)} accent="indigo" />
      </div>

      <button type="button" className="btn btn--primary btn--block btn--lg" onClick={openCreate}>
        <Plus size={18} /> Add Expense
      </button>

      <h2 className="section-title">Transaction Ledger</h2>

      {loading.expenses ? (
        <div className="stack">
          <Skeleton height={64} />
          <Skeleton height={64} />
          <Skeleton height={64} />
        </div>
      ) : expenses.length === 0 ? (
        <EmptyState
          icon="🧾"
          title="No expenses yet"
          subtitle="Nothing recorded for this month. Add the first expense to get started."
        />
      ) : (
        <div className="ledger">
          {expenses.map((e) => (
            <ExpenseItem key={e._id} expense={e} canEdit={true} onEdit={openEdit} onDelete={(x) => setDeleting(x)} />
          ))}
        </div>
      )}

      <BottomSheet
        open={sheetOpen}
        onClose={() => {
          setSheetOpen(false);
          setEditing(null);
        }}
        title={editing ? 'Edit Expense' : 'Add Expense'}
      >
        <ExpenseForm
          users={users}
          initial={editing}
          submitting={submitting}
          onSubmit={handleSubmit}
          onCancel={() => {
            setSheetOpen(false);
            setEditing(null);
          }}
        />
      </BottomSheet>

      <ConfirmModal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title="Delete Expense"
        message={`Delete this ${deleting?.category || ''} expense of ${formatCurrency(deleting?.amount || 0)}? This cannot be undone.`}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
