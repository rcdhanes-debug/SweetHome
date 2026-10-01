import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, ChevronLeft, ChevronRight, RotateCcw, Calendar } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import * as expenseApi from '../services/expenses';
import * as fundingApi from '../services/funding';
import StatCard from '../components/StatCard';
import ExpenseItem from '../components/ExpenseItem';
import ExpenseForm from '../components/ExpenseForm';
import BottomSheet from '../components/BottomSheet';
import ConfirmModal from '../components/ConfirmModal';
import Confetti from '../components/Confetti';
import Skeleton from '../components/Skeleton';
import EmptyState from '../components/EmptyState';
import { formatCurrency, monthKey, monthLabel, todayISTDateString } from '../utils/format';

export default function Expenses() {
  const { history, users, reloadExpenses } = useApp();
  const { session, runWithAuth } = useAuth();
  const toast = useToast();

  const currentMonthKey = useMemo(() => monthKey(), []);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey);
  const [monthExpenses, setMonthExpenses] = useState([]);
  const [monthFunding, setMonthFunding] = useState(null);
  const [loadingMonth, setLoadingMonth] = useState(true);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [celebrate, setCelebrate] = useState(false);
  const [page, setPage] = useState(1);

  const isCurrentMonth = selectedMonth === currentMonthKey;

  // Generate available month options (current month + past 12 months + any from history)
  const monthOptions = useMemo(() => {
    const set = new Set();
    set.add(currentMonthKey);

    const now = new Date();
    for (let i = 0; i < 12; i += 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      set.add(monthKey(d));
    }

    if (Array.isArray(history)) {
      history.forEach((h) => {
        if (h.month) set.add(h.month);
      });
    }

    return Array.from(set)
      .sort((a, b) => b.localeCompare(a))
      .map((key) => ({
        key,
        label: monthLabel(key),
        isCurrent: key === currentMonthKey
      }));
  }, [currentMonthKey, history]);

  // Load expenses and funding summary for selectedMonth
  const loadMonthData = useCallback(async (month) => {
    setLoadingMonth(true);
    try {
      const [expList, fundSummary] = await Promise.all([
        expenseApi.listExpenses(month),
        fundingApi.getCurrent(month)
      ]);
      setMonthExpenses(expList || []);
      setMonthFunding(fundSummary || null);
    } catch (err) {
      console.error('Failed to load month data', err);
      toast.show('Failed to load month data', 'error');
    } finally {
      setLoadingMonth(false);
    }
  }, [toast]);

  useEffect(() => {
    loadMonthData(selectedMonth);
    setPage(1);
  }, [selectedMonth, loadMonthData]);

  // Navigate forward/backward
  const handleNavigateMonth = (direction) => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const nextDate = new Date(Date.UTC(y, m - 1 + direction, 1));
    const nextKey = monthKey(nextDate);
    if (nextKey <= currentMonthKey) {
      setSelectedMonth(nextKey);
    }
  };

  // Pagination calculation
  const pageSize = 5;
  const totalPages = Math.ceil(monthExpenses.length / pageSize) || 1;
  const paginatedExpenses = monthExpenses.slice((page - 1) * pageSize, page * pageSize);

  const totalSpent = monthExpenses.reduce((s, e) => s + e.amount, 0);
  const collected = monthFunding?.totalCollected || 0;
  const balance = monthFunding?.balance !== undefined ? monthFunding.balance : (collected - totalSpent);

  // Default date for new expense when viewing past month
  const defaultExpenseDate = useMemo(() => {
    if (isCurrentMonth) return todayISTDateString();
    const [y, m] = selectedMonth.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    const mm = String(m).padStart(2, '0');
    const dd = String(lastDay).padStart(2, '0');
    return `${y}-${mm}-${dd}`;
  }, [selectedMonth, isCurrentMonth]);

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
      await loadMonthData(selectedMonth);
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
      await loadMonthData(selectedMonth);
      await reloadExpenses();
    } catch (err) {
      if (err.message !== 'Cancelled') toast.show(err.message, 'error');
    }
  };

  return (
    <div className="page">
      {celebrate && <Confetti onDone={() => setCelebrate(false)} />}

      {/* Month Switcher Header */}
      <div className="month-switcher-card">
        <div className="month-switcher__controls">
          <button
            type="button"
            className="icon-btn"
            onClick={() => handleNavigateMonth(-1)}
            title="Previous month"
          >
            <ChevronLeft size={16} />
          </button>

          <div className="month-switcher__select-wrapper">
            <select
              className="month-switcher__select"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            >
              {monthOptions.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label} {m.isCurrent ? '(Current Month)' : ''}
                </option>
              ))}
            </select>
            <div className="month-switcher__label">
              <Calendar size={15} style={{ opacity: 0.7 }} />
              <span className="month-switcher__title">{monthLabel(selectedMonth)}</span>
              {isCurrentMonth ? (
                <span className="badge badge--today">Current</span>
              ) : (
                <span className="badge badge--admin">Past</span>
              )}
            </div>
          </div>

          <button
            type="button"
            className="icon-btn"
            onClick={() => handleNavigateMonth(1)}
            disabled={isCurrentMonth}
            title="Next month"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {!isCurrentMonth && (
          <div className="month-switcher__banner">
            <span>Viewing expenses for <strong>{monthLabel(selectedMonth)}</strong></span>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => setSelectedMonth(currentMonthKey)}
            >
              <RotateCcw size={13} /> Current Month
            </button>
          </div>
        )}
      </div>

      <div className="balance-grid">
        <StatCard label="Collected" value={formatCurrency(collected)} accent="green" />
        <StatCard label="Spent" value={formatCurrency(totalSpent)} accent="red" />
        <StatCard label="Available" value={formatCurrency(balance)} accent="indigo" />
      </div>

      <button type="button" className="btn btn--primary btn--block btn--lg" onClick={openCreate}>
        <Plus size={18} /> Add Expense
      </button>

      <h2 className="section-title">
        Transaction Ledger {selectedMonth !== currentMonthKey && `(${monthLabel(selectedMonth)})`}
      </h2>

      {loadingMonth ? (
        <div className="stack">
          <Skeleton height={64} />
          <Skeleton height={64} />
          <Skeleton height={64} />
        </div>
      ) : monthExpenses.length === 0 ? (
        <EmptyState
          icon="🧾"
          title="No expenses found"
          subtitle={`Nothing recorded for ${monthLabel(selectedMonth)}. Add an expense to get started.`}
        />
      ) : (
        <>
          <div className="ledger">
            {paginatedExpenses.map((e) => (
              <ExpenseItem key={e._id} expense={e} canEdit={true} onEdit={openEdit} onDelete={(x) => setDeleting(x)} />
            ))}
          </div>

          {monthExpenses.length > pageSize && (
            <div className="pagination" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '16px', gap: '12px' }}>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
              >
                <ChevronLeft size={16} /> Previous
              </button>
              <span className="muted" style={{ fontSize: '13px', fontWeight: 600 }}>
                Page {page} of {totalPages} ({monthExpenses.length} total)
              </span>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
              >
                Next <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
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
          defaultDate={defaultExpenseDate}
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
