const funding = require('../services/fundingService');
const audit = require('../services/auditService');
const asyncHandler = require('../utils/asyncHandler');
const { monthKey } = require('../utils/time');

const getCurrent = asyncHandler(async (req, res) => {
  res.json(await funding.getCurrentSummary());
});

const getHistory = asyncHandler(async (req, res) => {
  res.json(await funding.listHistory());
});

const getReport = asyncHandler(async (req, res) => {
  const { month } = req.query;
  const target = month && /^\d{4}-\d{2}$/.test(month) ? month : monthKey();
  res.json(await funding.getReport(target));
});

const markPaid = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const me = req.user;
  const { amount } = req.body || {};

  const summary = await funding.markPaid({ userId, amount, performedBy: me._id });

  await audit.log({
    action: 'CONTRIBUTION_PAID',
    performedBy: me._id,
    targetUser: userId,
    details: { month: monthKey(), amount }
  });

  res.json(summary);
});

const setStatus = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { paid, paidAt } = req.body || {};

  const summary = await funding.setPaymentStatus({
    userId,
    paid: Boolean(paid),
    paidAt: paidAt || null,
    performedBy: req.user._id
  });

  await audit.log({
    action: paid ? 'CONTRIBUTION_PAID' : 'CONTRIBUTION_RESET',
    performedBy: req.user._id,
    targetUser: userId,
    details: { month: monthKey(), paid: Boolean(paid), paidAt: paidAt || null }
  });

  res.json(summary);
});

const resetMonth = asyncHandler(async (req, res) => {
  const { month } = req.body || {};
  const target = month && /^\d{4}-\d{2}$/.test(month) ? month : monthKey();

  const summary = await funding.resetMonth(target);

  await audit.log({
    action: 'CONTRIBUTION_RESET',
    performedBy: req.user._id,
    details: { month: target }
  });

  res.json(summary);
});

const setContributionAmount = asyncHandler(async (req, res) => {
  const { month, amount } = req.body || {};
  const target = month && /^\d{4}-\d{2}$/.test(month) ? month : monthKey();

  const result = await funding.setContributionAmount({
    month: target,
    amount,
    performedBy: req.user._id
  });

  res.json(result);
});

const setRolloverAmount = asyncHandler(async (req, res) => {
  const { month, amount, auto } = req.body || {};
  const target = month && /^\d{4}-\d{2}$/.test(month) ? month : monthKey();

  const summary = await funding.setRolloverAmount({
    month: target,
    amount,
    auto: Boolean(auto),
    performedBy: req.user._id
  });

  res.json(summary);
});

const updateCommonAccount = asyncHandler(async (req, res) => {
  const { upiId, qrImage } = req.body || {};
  const result = await funding.updateCommonAccount({
    upiId,
    qrImage,
    performedBy: req.user._id
  });
  res.json(result);
});

module.exports = { getCurrent, getHistory, getReport, markPaid, setStatus, resetMonth, setContributionAmount, setRolloverAmount, updateCommonAccount };

