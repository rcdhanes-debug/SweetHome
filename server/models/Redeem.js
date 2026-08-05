const mongoose = require('mongoose');

const redeemSchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true, min: 0.01 },
    upiId: { type: String, required: true, trim: true, maxlength: 120 },
    note: { type: String, trim: true, maxlength: 300, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    closed: { type: Boolean, default: false },
    closedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    closedByName: { type: String, default: '' },
    closedAt: { type: Date, default: null },
    expenseRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Expense', default: null }
  },
  { timestamps: true }
);

redeemSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Redeem', redeemSchema);
