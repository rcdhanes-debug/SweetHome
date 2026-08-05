const mongoose = require('mongoose');
const { CATEGORIES } = require('../utils/constants');

const expenseSchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true, min: 0.01 },
    category: { type: String, required: true, enum: CATEGORIES },
    description: { type: String, trim: true, default: '' },
    paidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    expenseDate: { type: Date, required: true, default: Date.now },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

expenseSchema.index({ expenseDate: -1 });

module.exports = mongoose.model('Expense', expenseSchema);
