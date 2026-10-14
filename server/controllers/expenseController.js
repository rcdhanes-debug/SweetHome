const expenses = require('../services/expenseService');
const audit = require('../services/auditService');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { monthKey } = require('../utils/time');

const list = asyncHandler(async (req, res) => {
  const month = req.query.month && /^\d{4}-\d{2}$/.test(req.query.month) ? req.query.month : monthKey();
  res.json(await expenses.listForMonth(month));
});

const currentMonth = asyncHandler(async (req, res) => {
  const month = req.query.month && /^\d{4}-\d{2}$/.test(req.query.month) ? req.query.month : monthKey();
  res.json(await expenses.summaryForMonth(month));
});

const create = asyncHandler(async (req, res) => {
  const body = expenses.validateExpenseBody(req.body || {});
  const userId = req.user ? req.user._id : body.paidBy;

  if (req.user && req.user.role !== 'admin' && String(body.paidBy) !== String(req.user._id)) {
    throw new AppError('You can only record an expense you paid for.', 403);
  }

  const expense = await expenses.createExpense({ ...body, createdBy: userId });

  // Also log into BankTransaction so the ledger reflects this manual expense
  try {
    const BankTransaction = require('../models/BankTransaction');
    const BankBalance = require('../models/BankBalance');
    const curBal = await BankBalance.findOne({ bankName: 'IDFC FIRST Bank' });
    const newBal = curBal ? Math.max(0, curBal.balance - expense.amount) : 0;
    if (curBal) {
      curBal.balance = newBal;
      curBal.lastTransactionType = 'DEBIT';
      curBal.lastTransactionAmount = expense.amount;
      curBal.lastRecipient = expense.description || expense.category;
      curBal.syncSource = 'MANUAL';
      curBal.lastSyncedAt = expense.expenseDate || new Date();
      await curBal.save();
    }
    await BankTransaction.create({
      bankName: 'IDFC FIRST Bank',
      accountLast4: curBal?.accountLast4 || '4202',
      type: 'DEBIT',
      amount: expense.amount,
      balanceAfter: newBal,
      recipient: expense.description || expense.category,
      description: `Manual: ${expense.description || expense.category}`,
      reference: 'MANUAL',
      date: expense.expenseDate || new Date(),
      source: 'MANUAL'
    });
  } catch (tErr) {
    console.error('Failed to create manual BankTransaction:', tErr);
  }

  await audit.log({
    action: 'EXPENSE_CREATED',
    performedBy: userId,
    details: {
      id: expense._id,
      amount: expense.amount,
      category: expense.category,
      paidBy: expense.paidBy ? expense.paidBy.name : body.paidBy
    }
  });

  res.status(201).json(expense);
});

const update = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const patch = { ...(req.body || {}) };

  if (patch.amount !== undefined) {
    const num = Number(patch.amount);
    if (!Number.isFinite(num) || num <= 0) throw new AppError('Expense amount must be greater than ₹0.', 400);
    patch.amount = Math.round(num * 100) / 100;
  }
  if (patch.expenseDate && Number.isNaN(Date.parse(patch.expenseDate))) {
    throw new AppError('Expense date is invalid.', 400);
  }

  const expense = await expenses.updateExpense(id, patch);

  await audit.log({
    action: 'EXPENSE_EDITED',
    performedBy: req.user._id,
    details: { id: expense._id, patch }
  });

  res.json(expense);
});

const remove = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const expense = await expenses.deleteExpense(id);

  await audit.log({
    action: 'EXPENSE_DELETED',
    performedBy: req.user._id,
    details: { id: expense._id, amount: expense.amount, category: expense.category }
  });

  res.json({ message: 'Expense deleted.', id });
});

module.exports = { list, currentMonth, create, update, remove };
