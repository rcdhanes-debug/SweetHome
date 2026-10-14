const redeem = require('../services/redeemService');
const audit = require('../services/auditService');
const asyncHandler = require('../utils/asyncHandler');
const Expense = require('../models/Expense');
const User = require('../models/User');
const { monthKey } = require('../utils/time');

const list = asyncHandler(async (req, res) => {
  res.json(await redeem.listRedeems());
});

const create = asyncHandler(async (req, res) => {
  const { amount, upiId, note, userId, userName } = req.body || {};
  let creatorId = req.user?._id || userId;

  if (!creatorId && userName) {
    const user = await User.findOne({ name: userName });
    if (user) creatorId = user._id;
  }

  if (!creatorId) {
    const defaultUser = await User.findOne();
    creatorId = defaultUser?._id;
  }

  const item = await redeem.createRedeem({ amount, upiId, note, createdBy: creatorId });

  await audit.log({
    action: 'REDEEM_CREATED',
    performedBy: creatorId,
    details: { id: item._id, amount: item.amount, upiId: item.upiId }
  });

  res.status(201).json(item);
});

const close = asyncHandler(async (req, res) => {
  const { closedByName } = req.body || {};
  const item = await redeem.setRedeemClosed(req.params.id, { closed: true, closedByName: closedByName || 'Unknown' });

  // Look up the settler (Ashwin) by name to use as paidBy in the expense
  const settler = closedByName ? await User.findOne({ name: closedByName }) : null;
  const settlerOrCreator = settler?._id || item.createdBy._id || item.createdBy;

  // Cross-check if a matching BankTransaction DEBIT arrived today to prevent double counting
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const BankTransaction = require('../models/BankTransaction');
  const existingTxn = await BankTransaction.findOne({
    type: 'DEBIT',
    amount: item.amount,
    redeemRef: null,
    date: { $gte: startOfDay }
  });

  let expense = null;
  if (existingTxn) {
    // Bank SMS arrived earlier! Link it
    item.bankTransactionRef = existingTxn._id;
    item.source = 'SMS';
    existingTxn.redeemRef = item._id;
    await existingTxn.save();

    // Check if an expense was already created for this bank transaction
    expense = await Expense.findOne({ bankTransactionRef: existingTxn._id });
    if (expense) {
      expense.description = item.note ? `Redeem: ${item.note}` : `Redeem payout — ${item.createdBy?.name || 'housemate'}`;
      expense.redeemRef = item._id;
      if (settlerOrCreator) expense.paidBy = settlerOrCreator;
      await expense.save();
    }
  }

  // If no expense exists yet (e.g. marked on website before bank SMS arrived), create single expense
  if (!expense) {
    const today = new Date().toISOString().slice(0, 10);
    expense = await Expense.create({
      amount: item.amount,
      category: 'Misc',
      description: item.note ? `Redeem: ${item.note}` : `Redeem payout — ${item.createdBy?.name || 'housemate'}`,
      expenseDate: today,
      paidBy: settlerOrCreator,
      createdBy: settlerOrCreator,
      bankTransactionRef: item.bankTransactionRef || null,
      redeemRef: item._id
    });
  }

  // Store reference so we can delete on reopen
  item.expenseRef = expense._id;
  await item.save();

  await audit.log({
    action: 'REDEEM_CLOSED',
    performedBy: settlerOrCreator,
    details: {
      id: item._id,
      amount: item.amount,
      upiId: item.upiId,
      closedBy: closedByName,
      expenseId: expense._id,
      bankTransactionId: item.bankTransactionRef
    }
  });

  res.json(item);
});

const reopen = asyncHandler(async (req, res) => {
  const item = await redeem.setRedeemClosed(req.params.id, { closed: false, performedBy: req.user._id });

  // Delete the auto-created expense if it exists
  if (item.expenseRef) {
    await Expense.findByIdAndDelete(item.expenseRef);
    item.expenseRef = null;
  }

  // Unlink bank transaction if attached
  if (item.bankTransactionRef) {
    const BankTransaction = require('../models/BankTransaction');
    await BankTransaction.findByIdAndUpdate(item.bankTransactionRef, { redeemRef: null });
    item.bankTransactionRef = null;
    item.source = 'MANUAL';
  }

  await item.save();

  await audit.log({
    action: 'REDEEM_REOPENED',
    performedBy: req.user._id,
    details: { id: item._id, amount: item.amount, upiId: item.upiId }
  });

  res.json(item);
});

const remove = asyncHandler(async (req, res) => {
  const item = await redeem.deleteRedeem(req.params.id);

  // Clean up linked expense if present
  if (item.expenseRef) {
    await Expense.findByIdAndDelete(item.expenseRef);
  }

  // Unlink bank transaction
  if (item.bankTransactionRef) {
    const BankTransaction = require('../models/BankTransaction');
    await BankTransaction.findByIdAndUpdate(item.bankTransactionRef, { redeemRef: null });
  }

  await audit.log({
    action: 'REDEEM_DELETED',
    performedBy: req.user._id,
    details: { id: item._id, amount: item.amount, upiId: item.upiId }
  });

  res.json({ message: 'Redeem request removed.' });
});

module.exports = { list, create, close, reopen, remove };
