import { Pencil, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import CategoryIcon from './CategoryIcon';
import { formatCurrency, formatDate } from '../utils/format';

export default function ExpenseItem({ expense, canEdit = true, onEdit, onDelete }) {
  return (
    <motion.div
      className="expense-item"
      onClick={() => canEdit && onEdit?.(expense)}
      role={canEdit ? 'button' : undefined}
      tabIndex={canEdit ? 0 : undefined}
      whileTap={{ scale: 0.97 }}
      animate={{ boxShadow: '0 0 0px rgba(34,211,238,0)' }}
      style={{ cursor: canEdit ? 'pointer' : 'default', userSelect: 'none' }}
      onKeyDown={(e) => e.key === 'Enter' && canEdit && onEdit?.(expense)}
    >
      <CategoryIcon category={expense.category} size={20} />
      <div className="expense-item__body">
        <div className="expense-item__category">{expense.description || expense.category}</div>
        {expense.description && <div className="expense-item__desc">{expense.category}</div>}
        <div className="expense-item__meta">
          <span>Paid by {expense.paidBy?.name || '—'}</span>
          <span>•</span>
          <span>{formatDate(expense.expenseDate)}</span>
        </div>
      </div>
      <div className="expense-item__right">
        <div className="expense-item__amount">{formatCurrency(expense.amount)}</div>
        {canEdit && (
          <div className="expense-item__actions">
            <motion.button
              className="icon-btn icon-btn--sm"
              whileTap={{ scale: 0.88 }}
              onClick={(e) => { e.stopPropagation(); onEdit?.(expense); }}
              aria-label="Edit"
            >
              <Pencil size={15} />
            </motion.button>
            <motion.button
              className="icon-btn icon-btn--sm icon-btn--danger"
              whileTap={{ scale: 0.88 }}
              onClick={(e) => { e.stopPropagation(); onDelete?.(expense); }}
              aria-label="Delete"
            >
              <Trash2 size={15} />
            </motion.button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
