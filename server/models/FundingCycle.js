const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    paid: { type: Boolean, default: false },
    amount: { type: Number, required: true },
    paidAt: { type: Date, default: null },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { _id: false }
);

const fundingCycleSchema = new mongoose.Schema(
  {
    month: { type: String, required: true, unique: true },
    targetAmount: { type: Number, required: true },
    contributionAmount: { type: Number, required: true },
    totalCollected: { type: Number, default: 0 },
    customRollover: { type: Number, default: null },
    payments: [paymentSchema]
  },
  { timestamps: true }
);

module.exports = mongoose.model('FundingCycle', fundingCycleSchema);
