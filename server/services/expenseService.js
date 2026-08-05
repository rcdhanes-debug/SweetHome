const Expense = require('../models/Expense');
const FundingCycle = require('../models/FundingCycle');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const { CATEGORIES } = require('../utils/constants');
const { monthKey, istMonthRange } = require('../utils/time');

async function listForMonth(month = monthKey()) {
  const { start, end } = istMonthRange(month);
  return Expense.find({ expenseDate: { $gte: start, $lt: end } })
    .sort({ expenseDate: -1, createdAt: -1 })
    .populate('paidBy', 'name')
    .populate('createdBy', 'name');
}

async function summaryForMonth(month = monthKey()) {
  const { start, end } = istMonthRange(month);
  const agg = await Expense.aggregate([
    { $match: { expenseDate: { $gte: start, $lt: end } } },
    { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
  ]);
  const totalSpent = agg[0]?.total || 0;
  const count = agg[0]?.count || 0;

  const cycle = await FundingCycle.findOne({ month });
  const totalCollected = cycle
    ? cycle.payments.filter((p) => p.paid).reduce((s, p) => s + p.amount, 0)
    : 0;

  return { month, totalCollected, totalSpent, balance: totalCollected - totalSpent, count };
}

async function createExpense({ amount, category, description, paidBy, expenseDate, createdBy }) {
  const paidByUser = await User.findById(paidBy);
  if (!paidByUser) throw new AppError('Paid By user does not exist.', 400);

  const expense = await Expense.create({
    amount,
    category,
    description: description || '',
    paidBy: paidByUser._id,
    expenseDate: expenseDate ? new Date(expenseDate) : new Date(),
    createdBy
  });

  return Expense.findById(expense._id).populate('paidBy', 'name').populate('createdBy', 'name');
}

async function updateExpense(id, patch) {
  const expense = await Expense.findById(id);
  if (!expense) throw new AppError('Expense not found.', 404);

  if (patch.amount !== undefined) expense.amount = patch.amount;
  if (patch.category !== undefined) expense.category = patch.category;
  if (patch.description !== undefined) expense.description = patch.description;
  if (patch.paidBy !== undefined) {
    const paidByUser = await User.findById(patch.paidBy);
    if (!paidByUser) throw new AppError('Paid By user does not exist.', 400);
    expense.paidBy = paidByUser._id;
  }
  if (patch.expenseDate !== undefined) expense.expenseDate = new Date(patch.expenseDate);

  await expense.save();
  return Expense.findById(expense._id).populate('paidBy', 'name').populate('createdBy', 'name');
}

async function deleteExpense(id) {
  const expense = await Expense.findById(id);
  if (!expense) throw new AppError('Expense not found.', 404);
  await expense.deleteOne();
  return expense;
}

function validateExpenseBody(body) {
  const { amount, category } = body;
  if (amount === undefined || amount === null || amount === '') {
    throw new AppError('Expense amount is required.', 400);
  }
  const num = Number(amount);
  if (!Number.isFinite(num) || num <= 0) {
    throw new AppError('Expense amount must be greater than ₹0.', 400);
  }
  if (!CATEGORIES.includes(category)) {
    throw new AppError(`Category must be one of: ${CATEGORIES.join(', ')}.`, 400);
  }
  if (body.expenseDate && Number.isNaN(Date.parse(body.expenseDate))) {
    throw new AppError('Expense date is invalid.', 400);
  }
  return { ...body, amount: Math.round(num * 100) / 100 };
}

module.exports = {
  listForMonth,
  summaryForMonth,
  createExpense,
  updateExpense,
  deleteExpense,
  validateExpenseBody
};
