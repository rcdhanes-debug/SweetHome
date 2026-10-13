const mongoose = require('mongoose');

const bankBalanceSchema = new mongoose.Schema(
  {
    bankName: {
      type: String,
      required: true,
      default: 'IDFC FIRST Bank'
    },
    accountLast4: {
      type: String,
      default: '****'
    },
    balance: {
      type: Number,
      required: true,
      default: 0
    },
    currency: {
      type: String,
      default: 'INR'
    },
    lastTransactionType: {
      type: String,
      enum: ['DEBIT', 'CREDIT', 'UNKNOWN'],
      default: 'UNKNOWN'
    },
    lastTransactionAmount: {
      type: Number,
      default: 0
    },
    lastRecipient: {
      type: String,
      default: ''
    },
    lastEmailSubject: {
      type: String,
      default: ''
    },
    lastEmailDate: {
      type: Date
    },
    syncSource: {
      type: String,
      enum: ['SMS', 'EMAIL', 'MANUAL'],
      default: 'SMS'
    },
    lastSmsContent: {
      type: String,
      default: ''
    },
    lastSender: {
      type: String,
      default: ''
    },
    lastSyncedAt: {
      type: Date,
      default: Date.now
    },
    lastSyncStatus: {
      type: String,
      enum: ['SUCCESS', 'ERROR', 'IDLE'],
      default: 'IDLE'
    },
    lastSyncError: {
      type: String,
      default: ''
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('BankBalance', bankBalanceSchema);
