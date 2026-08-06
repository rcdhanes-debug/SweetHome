const FundingCycle = require('../models/FundingCycle');
const FundingSetting = require('../models/FundingSetting');
const HouseSetting = require('../models/HouseSetting');
const Expense = require('../models/Expense');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const audit = require('./auditService');
const {
  USER_ORDER,
  CONTRIBUTION_AMOUNT,
  PAYMENT_DEADLINE_DAY
} = require('../utils/constants');
const { monthKey, monthLabel, nextMonthKey, istMonthRange, deadlineInfo } = require('../utils/time');

function recomputeTotal(cycle) {
  const total = cycle.payments.filter((p) => p.paid).reduce((sum, p) => sum + (p.amount || 0), 0);
  cycle.totalCollected = total;
  return total;
}

async function getCommonAccount() {
  let doc = await HouseSetting.findOne({ key: 'common_account' });
  if (!doc) {
    doc = await HouseSetting.create({ key: 'common_account', upiId: 'sweethome@okaxis', qrImage: '/sweethome_upi_qr.png' });
  }
  return { upiId: doc.upiId, qrImage: doc.qrImage };
}

async function updateCommonAccount({ upiId, qrImage, performedBy }) {
  let doc = await HouseSetting.findOne({ key: 'common_account' });
  if (!doc) {
    doc = new HouseSetting({ key: 'common_account' });
  }
  if (upiId !== undefined) {
    const clean = String(upiId).trim();
    if (!clean || !/^[^\s@]+@[a-zA-Z]{2,}$/.test(clean)) {
      throw new AppError('Enter a valid UPI ID (e.g. name@okbank).', 400);
    }
    doc.upiId = clean;
  }
  if (qrImage !== undefined) {
    if (qrImage && typeof qrImage === 'string' && qrImage.startsWith('data:image/')) {
      const buf = Buffer.from(qrImage.slice(qrImage.indexOf(',') + 1), 'base64');
      if (buf.length > 500 * 1024) throw new AppError('QR image is too large. Maximum size is 500 KB.', 400);
    }
    doc.qrImage = qrImage;
  }
  await doc.save();

  await audit.log({
    action: 'COMMON_ACCOUNT_UPDATED',
    performedBy,
    details: { upiId: doc.upiId }
  });

  return { upiId: doc.upiId, qrImage: doc.qrImage };
}

async function getSetting(month) {
  return FundingSetting.findOne({ month }).lean();
}

async function createCycle(month) {
  const users = await User.find().sort({ name: 1 });
  if (users.length === 0) {
    throw new AppError('No users exist yet. Please seed the database first.', 500);
  }
  const setting = await getSetting(month);
  const contributionAmount = setting?.contributionAmount ?? CONTRIBUTION_AMOUNT;
  const payments = USER_ORDER.map((name) => {
    const u = users.find((x) => x.name === name);
    if (!u) throw new AppError(`Seed user "${name}" is missing. Please run the seed script.`, 500);
    return {
      user: u._id,
      paid: false,
      amount: 0,
      paidAt: null,
      recordedBy: null
    };
  });
  return FundingCycle.create({
    month,
    targetAmount: contributionAmount * payments.length,
    contributionAmount,
    totalCollected: 0,
    payments
  });
}

async function ensureCycle(month = monthKey()) {
  let cycle = await FundingCycle.findOne({ month });
  if (!cycle) cycle = await createCycle(month);
  return cycle;
}

async function currentCycle() {
  return ensureCycle(monthKey());
}

async function getCycle(month) {
  return ensureCycle(month);
}

async function calculateAutoRollover(currentMonthKey) {
  const prevCycles = await FundingCycle.find({ month: { $lt: currentMonthKey } });
  let totalRollover = 0;
  for (const pc of prevCycles) {
    const pcRange = istMonthRange(pc.month);
    const pcSpentAgg = await Expense.aggregate([
      { $match: { expenseDate: { $gte: pcRange.start, $lt: pcRange.end } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    let pcCollected = 0;
    for (const p of pc.payments) {
      if (p.amount > 0 && p.amount < pc.contributionAmount) {
        pcCollected += p.amount;
      } else if (p.paid) {
        pcCollected += (p.amount || pc.contributionAmount);
      }
    }
    const pcSpent = pcSpentAgg[0]?.total || 0;
    const pcNet = pcCollected - pcSpent;
    if (pcNet > 0) totalRollover += pcNet;
  }
  return totalRollover;
}

async function getCurrentSummary() {
  const cycle = await currentCycle();
  const populated = await FundingCycle.findById(cycle._id).populate('payments.user', 'name role').populate('payments.recordedBy', 'name');

  const { start, end } = istMonthRange(cycle.month);
  const spentAgg = await Expense.aggregate([
    { $match: { expenseDate: { $gte: start, $lt: end } } },
    { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
  ]);
  const totalSpent = spentAgg[0]?.total || 0;
  const expenseCount = spentAgg[0]?.count || 0;

  let rolloverBalance = 0;
  let isCustomRollover = false;

  if (cycle.customRollover !== null && cycle.customRollover !== undefined) {
    rolloverBalance = cycle.customRollover;
    isCustomRollover = true;
  } else {
    rolloverBalance = await calculateAutoRollover(cycle.month);
  }

  const payments = populated.payments.map((p) => {
    let paidAmt = 0;
    if (p.amount > 0 && p.amount < cycle.contributionAmount) {
      paidAmt = p.amount;
    } else if (p.paid) {
      paidAmt = p.amount || cycle.contributionAmount;
    } else {
      paidAmt = 0;
    }

    const isPaid = paidAmt >= cycle.contributionAmount;
    const isPartial = !isPaid && paidAmt > 0;
    const dueAmount = Math.max(0, cycle.contributionAmount - paidAmt);
    const status = isPaid ? 'paid' : (isPartial ? 'partial' : 'pending');

    return {
      user: p.user ? { _id: p.user._id, name: p.user.name, role: p.user.role } : null,
      paid: isPaid,
      amount: paidAmt,
      targetAmount: cycle.contributionAmount,
      dueAmount,
      status,
      paidAt: p.paidAt,
      recordedBy: p.recordedBy ? { _id: p.recordedBy._id, name: p.recordedBy.name } : null
    };
  });

  const paidCount = payments.filter((p) => p.status === 'paid').length;
  const partialCount = payments.filter((p) => p.status === 'partial').length;
  const pendingCount = payments.filter((p) => p.status === 'pending').length;
  const totalCollected = payments.reduce((s, p) => s + (p.amount || 0), 0);
  const targetTotal = payments.length * cycle.contributionAmount;
  const commonAccount = await getCommonAccount();

  return {
    month: cycle.month,
    monthLabel: monthLabel(cycle.month),
    targetAmount: targetTotal,
    contributionAmount: cycle.contributionAmount,
    totalCollected,
    totalSpent,
    rolloverBalance,
    isCustomRollover,
    balance: rolloverBalance + totalCollected - totalSpent,
    paidCount,
    partialCount,
    pendingCount,
    deadline: { day: PAYMENT_DEADLINE_DAY, ...deadlineInfo(PAYMENT_DEADLINE_DAY) },
    commonAccount,
    payments: payments.sort((a, b) => {
      const order = Object.fromEntries(USER_ORDER.map((n, i) => [n, i]));
      const an = a.user?.name || '';
      const bn = b.user?.name || '';
      return (order[an] ?? 99) - (order[bn] ?? 99);
    })
  };
}

async function markPaid({ userId, performedBy, amount }) {
  const cycle = await currentCycle();
  const payment = cycle.payments.find((p) => String(p.user) === String(userId));
  if (!payment) throw new AppError('User is not part of this month\'s collection.', 404);

  let currentAmt = 0;
  if (payment.paid) {
    currentAmt = payment.amount || cycle.contributionAmount;
  } else if (payment.amount > 0 && payment.amount < cycle.contributionAmount) {
    currentAmt = payment.amount;
  } else {
    currentAmt = 0;
  }

  if (payment.paid || currentAmt >= cycle.contributionAmount) {
    throw new AppError('This contribution is already fully paid.', 409);
  }

  let addAmount = cycle.contributionAmount - currentAmt;
  if (amount !== undefined && amount !== null) {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0 || n > 100000000) {
      throw new AppError('Payment amount must be a positive number.', 400);
    }
    addAmount = Math.round(n * 100) / 100;
  }

  const newTotal = currentAmt + addAmount;
  payment.amount = newTotal;
  payment.paid = newTotal >= cycle.contributionAmount;
  payment.paidAt = new Date();
  payment.recordedBy = performedBy;

  await cycle.save();
  return getCurrentSummary();
}

async function setPaymentStatus({ userId, paid, paidAt, performedBy }) {
  const cycle = await currentCycle();
  const payment = cycle.payments.find((p) => String(p.user) === String(userId));
  if (!payment) throw new AppError('User is not part of this month\'s collection.', 404);

  payment.paid = Boolean(paid);
  if (paid) {
    payment.paidAt = paidAt && !Number.isNaN(Date.parse(paidAt)) ? new Date(paidAt) : new Date();
    payment.amount = cycle.contributionAmount;
    payment.recordedBy = performedBy;
  } else {
    payment.paid = false;
    payment.amount = 0;
    payment.paidAt = null;
    payment.recordedBy = null;
  }
  await cycle.save();
  return getCurrentSummary();
}

async function resetMonth(month = monthKey()) {
  const cycle = await ensureCycle(month);
  for (const p of cycle.payments) {
    p.paid = false;
    p.amount = 0;
    p.paidAt = null;
    p.recordedBy = null;
  }
  await cycle.save();
  return getCurrentSummary();
}

async function listHistory() {
  const cycles = await FundingCycle.find()
    .sort({ month: -1 })
    .populate('payments.user', 'name');
  return cycles.map((c) => {
    let collected = 0;
    for (const p of c.payments) {
      if (p.amount > 0 && p.amount < c.contributionAmount) {
        collected += p.amount;
      } else if (p.paid) {
        collected += (p.amount || c.contributionAmount);
      }
    }
    return {
      month: c.month,
      monthLabel: monthLabel(c.month),
      targetAmount: c.payments.length * c.contributionAmount,
      contributionAmount: c.contributionAmount,
      totalCollected: collected,
      paidCount: c.payments.filter((p) => (p.amount >= c.contributionAmount)).length,
      pendingCount: c.payments.filter((p) => !p.paid && (!p.amount || p.amount === c.contributionAmount)).length,
      payments: c.payments.map((p) => {
        const amt = (p.amount > 0 && p.amount < c.contributionAmount) ? p.amount : (p.paid ? (p.amount || c.contributionAmount) : 0);
        return {
          user: p.user ? { _id: p.user._id, name: p.user.name } : null,
          paid: amt >= c.contributionAmount,
          amount: amt,
          paidAt: p.paidAt
        };
      })
    };
  });
}

async function getReport(month = monthKey()) {
  const cycle = await ensureCycle(month);
  const populated = await FundingCycle.findById(cycle._id).populate('payments.user', 'name');
  const { start, end } = istMonthRange(month);

  const expenses = await Expense.find({ expenseDate: { $gte: start, $lt: end } })
    .sort({ expenseDate: 1 })
    .populate('paidBy', 'name');

  const categories = {};
  expenses.forEach((e) => {
    const c = categories[e.category] || (categories[e.category] = { category: e.category, total: 0, count: 0 });
    c.total += e.amount;
    c.count += 1;
  });

  const payments = populated.payments.map((p) => ({
    user: p.user ? { _id: p.user._id, name: p.user.name } : null,
    paid: p.paid,
    amount: p.amount,
    paidAt: p.paidAt
  }));

  const totalCollected = payments.filter((p) => p.paid).reduce((s, p) => s + p.amount, 0);
  const totalSpent = expenses.reduce((s, e) => s + e.amount, 0);

  return {
    month,
    monthLabel: monthLabel(month),
    generatedAt: new Date().toISOString(),
    targetAmount: payments.reduce((s, p) => s + (p.amount || 0), 0),
    contributionAmount: cycle.contributionAmount,
    totalCollected,
    totalSpent,
    balance: totalCollected - totalSpent,
    paidCount: payments.filter((p) => p.paid).length,
    pendingCount: payments.filter((p) => !p.paid).length,
    deadline: { day: PAYMENT_DEADLINE_DAY, ...deadlineInfo(PAYMENT_DEADLINE_DAY) },
    payments,
    expenses: expenses.map((e) => ({
      _id: e._id,
      amount: e.amount,
      category: e.category,
      description: e.description,
      expenseDate: e.expenseDate,
      paidBy: e.paidBy ? e.paidBy.name : '—'
    })),
    categories: Object.values(categories).sort((a, b) => b.total - a.total)
  };
}

async function ensureNextMonthCycle() {
  const current = monthKey();
  return ensureCycle(nextMonthKey(current));
}

async function setContributionAmount({ month = monthKey(), amount, performedBy = null }) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0 || n > 100000000) {
    throw new AppError('Contribution amount must be a positive number.', 400);
  }
  const rounded = Math.round(n * 100) / 100;

  await FundingSetting.findOneAndUpdate(
    { month },
    { contributionAmount: rounded },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const cycle = await FundingCycle.findOne({ month });
  if (cycle) {
    cycle.contributionAmount = rounded;
    for (const p of cycle.payments) {
      if (!p.paid) p.amount = rounded;
    }
    cycle.targetAmount = cycle.payments.reduce((s, p) => s + (p.amount || 0), 0);
    recomputeTotal(cycle);
    await cycle.save();
  }

  await audit.log({
    action: 'FUNDING_AMOUNT_SET',
    performedBy,
    details: { month, contributionAmount: rounded }
  });

  return {
    month,
    contributionAmount: rounded,
    targetAmount: cycle?.targetAmount ?? rounded * USER_ORDER.length
  };
}

async function setRolloverAmount({ month = monthKey(), amount, auto = false, performedBy = null }) {
  const cycle = await ensureCycle(month);
  if (auto) {
    cycle.customRollover = null;
  } else {
    const n = Number(amount);
    if (!Number.isFinite(n) || n < 0) {
      throw new AppError('Rollover amount must be a non-negative number.', 400);
    }
    cycle.customRollover = Math.round(n * 100) / 100;
  }
  await cycle.save();

  await audit.log({
    action: 'ROLLOVER_AMOUNT_SET',
    performedBy,
    details: { month, customRollover: cycle.customRollover }
  });

  return getCurrentSummary();
}

module.exports = {
  createCycle,
  ensureCycle,
  currentCycle,
  getCycle,
  getSetting,
  getCurrentSummary,
  markPaid,
  setPaymentStatus,
  resetMonth,
  setContributionAmount,
  setRolloverAmount,
  listHistory,
  getReport,
  ensureNextMonthCycle,
  recomputeTotal,
  getCommonAccount,
  updateCommonAccount
};
