const Redeem = require('../models/Redeem');
const AppError = require('../utils/AppError');

const UPI_PATTERN = /^[^\s@]+@[a-zA-Z]{2,}$/;

function validateAmount(amount) {
  const num = Number(amount);
  if (!Number.isFinite(num) || num <= 0 || num > 100000000) {
    throw new AppError('Redeem amount must be a positive number.', 400);
  }
  return Math.round(num * 100) / 100;
}

function validateUpi(upiId) {
  const clean = String(upiId || '').trim();
  if (!clean) throw new AppError('UPI ID is required.', 400);
  if (!UPI_PATTERN.test(clean)) throw new AppError('Enter a valid UPI ID (e.g. name@okbank).', 400);
  return clean;
}

async function listRedeems() {
  return Redeem.find()
    .sort({ closed: 1, createdAt: -1 })
    .populate('createdBy', 'name')
    .populate('closedBy', 'name');
}

async function createRedeem({ amount, upiId, note, createdBy }) {
  const redeem = await Redeem.create({
    amount: validateAmount(amount),
    upiId: validateUpi(upiId),
    note: String(note || '').trim().slice(0, 300),
    createdBy
  });
  return Redeem.findById(redeem._id).populate('createdBy', 'name');
}

async function setRedeemClosed(id, { closed, performedBy, closedByName }) {
  const redeem = await Redeem.findById(id);
  if (!redeem) throw new AppError('Redeem request not found.', 404);

  if (closed) {
    if (redeem.closed) throw new AppError('This redeem request is already closed.', 409);
    redeem.closed = true;
    redeem.closedBy = performedBy || null;
    redeem.closedByName = closedByName || '';
    redeem.closedAt = new Date();
  } else {
    redeem.closed = false;
    redeem.closedBy = null;
    redeem.closedByName = '';
    redeem.closedAt = null;
  }
  await redeem.save();
  return Redeem.findById(redeem._id).populate('createdBy', 'name').populate('closedBy', 'name');
}

async function deleteRedeem(id) {
  const redeem = await Redeem.findById(id);
  if (!redeem) throw new AppError('Redeem request not found.', 404);
  await redeem.deleteOne();
  return redeem;
}

module.exports = {
  listRedeems,
  createRedeem,
  setRedeemClosed,
  deleteRedeem
};
