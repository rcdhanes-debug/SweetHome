const asyncHandler = require('../utils/asyncHandler');
const {
  processBankSms,
  parseBankSms,
  getStoredBankBalance,
  getBankTransactions,
  BANK_NAME
} = require('../services/bankSmsService');
const BankBalance = require('../models/BankBalance');

/**
 * Validates optional webhook secret if configured in environment
 */
function isAuthorizedWebhook(req) {
  const secret = process.env.BANK_WEBHOOK_SECRET || 'sweet_home_secure_2026';

  const providedSecret =
    req.headers['x-webhook-secret'] ||
    req.headers['x-api-key'] ||
    req.query.secret ||
    req.query.token ||
    (req.body && (req.body.secret || req.body.token));

  return providedSecret === secret;
}

/**
 * Extracts message text, sender, and timestamp across various SMS Forwarder apps
 * Supports:
 * - SMS Forwarder (Android / kyhsgeekoid / lanren)
 * - Macrodroid / Tasker / AutoSMS
 * - JSON, Form URL-encoded, or raw text bodies
 */
function extractSmsPayload(req) {
  let message = '';
  let sender = '';
  let timestamp = null;

  if (typeof req.body === 'string') {
    message = req.body;
  } else if (req.body && typeof req.body === 'object') {
    message =
      req.body.content ||
      req.body.message ||
      req.body.text ||
      req.body.body ||
      req.body.msg ||
      req.body.sms ||
      req.body.sms_body ||
      '';

    sender =
      req.body.from ||
      req.body.sender ||
      req.body.phone ||
      req.body.title ||
      req.body.sender_name ||
      '';

    timestamp =
      req.body.timestamp ||
      req.body.time ||
      req.body.date ||
      req.body.sms_time ||
      null;
  }

  if (!message && (req.query.message || req.query.content || req.query.text)) {
    message = req.query.message || req.query.content || req.query.text;
  }
  if (!sender && (req.query.from || req.query.sender)) {
    sender = req.query.from || req.query.sender;
  }

  return {
    message: String(message || '').trim(),
    sender: String(sender || 'IDFC FIRST Bank').trim(),
    timestamp
  };
}

// POST /api/bank/sms-webhook (also /api/bank/webhook and /api/bank/sms)
const handleSmsWebhook = asyncHandler(async (req, res) => {
  if (!isAuthorizedWebhook(req)) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: Missing or invalid webhook secret token.'
    });
  }

  const { message, sender, timestamp } = extractSmsPayload(req);

  if (!message) {
    return res.status(400).json({
      success: false,
      message: 'No SMS message body found in request. Expected fields: content, message, text, or raw body.'
    });
  }

  const result = await processBankSms({
    sender,
    message,
    timestamp,
    rawPayload: req.body,
    simulated: false
  });

  // If flagged as OTP / sensitive message, acknowledge with 200/discard without modifying data
  if (result.isSensitive) {
    return res.status(200).json({
      success: false,
      ignored: true,
      message: result.message
    });
  }

  if (!result.success) {
    return res.status(422).json(result);
  }

  res.status(200).json(result);
});

// GET /api/bank/sms-webhook & GET /api/bank/webhook-info
const getWebhookInfo = asyncHandler(async (req, res) => {
  const host = req.get('host') || 'sweet-home-backend-y21s.onrender.com';
  const protocol = req.protocol || 'https';
  const secret = process.env.BANK_WEBHOOK_SECRET || 'sweet_home_secure_2026';
  const fullWebhookUrl = `${protocol}://${host}/api/bank/sms-webhook?secret=${secret}`;

  res.json({
    status: 'ACTIVE',
    bank: BANK_NAME,
    webhookUrl: fullWebhookUrl,
    method: 'POST',
    secretConfigured: true,
    securityFeatures: [
      'Token authentication verified on every request',
      'Automatic gatekeeper drops all OTP, PIN, and password messages',
      'Zero Telegram message transmission for bank data'
    ],
    instructions: {
      androidApp: 'SMS Forwarder',
      recommendedRule: 'Filter: Sender contains IDFC | Exclude: OTP, verification, password',
      expectedPayload: {
        from: 'VK-IDFCFB',
        content: 'Dear Customer, INR 450.00 debited from A/C ...4321 on 13-OCT-26 towards UPI/Swiggy. Avl Bal: INR 48,250.00.',
        timestamp: Date.now()
      }
    }
  });
});

// POST /api/bank/simulate-sms (test utility from UI)
const simulateSms = asyncHandler(async (req, res) => {
  const { message, sender } = req.body;
  if (!message) {
    return res.status(400).json({ success: false, message: 'Message text is required' });
  }

  const result = await processBankSms({
    sender: sender || 'Test / IDFCFB',
    message,
    timestamp: Date.now(),
    simulated: false
  });

  res.json(result);
});

// GET /api/bank/balance
const getBalance = asyncHandler(async (req, res) => {
  const record = await getStoredBankBalance();
  res.json({
    ...record.toObject(),
    webhookUrl: `/api/bank/sms-webhook`,
    syncSource: record.syncSource || 'SMS'
  });
});

// GET /api/bank/transactions
const getTransactions = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 50;
  const transactions = await getBankTransactions(limit);
  res.json({
    success: true,
    count: transactions.length,
    data: transactions
  });
});

// POST /api/bank/sync (Refreshes data for UI)
const syncBalance = asyncHandler(async (req, res) => {
  const record = await getStoredBankBalance();
  res.json({
    success: true,
    message: 'Bank balance status refreshed.',
    data: record
  });
});

// PATCH /api/bank/manual
const updateManualBalance = asyncHandler(async (req, res) => {
  const { balance, accountLast4, bankName } = req.body;
  const updateData = {};
  if (typeof balance === 'number') updateData.balance = balance;
  if (accountLast4) updateData.accountLast4 = accountLast4;
  if (bankName) updateData.bankName = bankName;
  updateData.syncSource = 'MANUAL';
  updateData.lastSyncedAt = new Date();
  updateData.lastSyncStatus = 'SUCCESS';
  updateData.lastSyncError = '';

  const record = await BankBalance.findOneAndUpdate(
    { bankName: bankName || BANK_NAME },
    updateData,
    { upsert: true, new: true }
  );

  res.json({ success: true, data: record });
});

module.exports = {
  handleSmsWebhook,
  getWebhookInfo,
  simulateSms,
  getBalance,
  getTransactions,
  syncBalance,
  updateManualBalance
};
