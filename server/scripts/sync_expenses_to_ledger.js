const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const Expense = require('../models/Expense');
const BankTransaction = require('../models/BankTransaction');
require('../models/User');

async function syncExpensesToLedger() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB Atlas.');

  // 1. Link already existing Chicken expense from Oct 18 if unlinked
  const chickenExp = await Expense.findById('6ad455a1bd73855a306a7733');
  if (chickenExp && !chickenExp.bankTransactionRef) {
    chickenExp.bankTransactionRef = '6ad455a1bd73855a306a773a';
    await chickenExp.save();
    console.log('Linked Oct 18 Chicken expense to existing BankTransaction.');
  }

  // 2. Find all unlinked expenses
  const unlinked = await Expense.find({
    $or: [{ bankTransactionRef: null }, { bankTransactionRef: { $exists: false } }]
  }).sort({ expenseDate: 1 }).populate('paidBy', 'name');

  console.log(`Found ${unlinked.length} unlinked expense(s) to sync into transaction ledger.`);

  let createdCount = 0;
  const monthCounts = {};

  for (const exp of unlinked) {
    const m = exp.expenseDate.toISOString().slice(0, 7);
    monthCounts[m] = (monthCounts[m] || 0) + 1;

    const recipient = exp.paidBy?.name || exp.description || exp.category;
    const desc = exp.description ? `${exp.category}: ${exp.description}` : exp.category;

    const txn = await BankTransaction.create({
      bankName: 'IDFC FIRST Bank',
      accountLast4: '4202',
      type: 'DEBIT',
      amount: exp.amount,
      balanceAfter: 0,
      recipient,
      description: desc,
      reference: 'MANUAL',
      date: exp.expenseDate,
      source: 'MANUAL',
      redeemRef: exp.redeemRef || null
    });

    exp.bankTransactionRef = txn._id;
    await exp.save();
    createdCount++;
  }

  console.log(`Successfully created ${createdCount} BankTransaction records.`);
  console.log('Breakdown by month:', monthCounts);

  const totalTxns = await BankTransaction.countDocuments();
  console.log(`Total BankTransactions in ledger now: ${totalTxns}`);

  process.exit(0);
}

syncExpensesToLedger().catch((err) => {
  console.error('Sync failed:', err);
  process.exit(1);
});
