const mongoose = require('mongoose');

const bankTransactionSchema = new mongoose.Schema(
  {
    bankName: {
      type: String,
      default: 'IDFC FIRST Bank'
    },
    accountLast4: {
      type: String,
      default: '****'
    },
    type: {
      type: String,
      enum: ['DEBIT', 'CREDIT', 'UNKNOWN'],
      required: true
    },
    amount: {
      type: Number,
      required: true
    },
    balanceAfter: {
      type: Number,
      default: 0
    },
    description: {
      type: String,
      default: 'Bank Transaction'
    },
    recipient: {
      type: String,
      default: ''
    },
    reference: {
      type: String,
      default: ''
    },
    date: {
      type: Date,
      default: Date.now
    },
    emailSubject: {
      type: String,
      default: ''
    },
    source: {
      type: String,
      enum: ['SMS', 'EMAIL', 'MANUAL'],
      default: 'SMS'
    },
    rawMessage: {
      type: String,
      default: ''
    },
    sender: {
      type: String,
      default: ''
    },
    isDemo: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('BankTransaction', bankTransactionSchema);
