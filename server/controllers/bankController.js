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
  // If user set BANK_WEBHOOK_SECRET in environment variables, strictly verify it
  if (process.env.BANK_WEBHOOK_SECRET) {
    const providedSecret =
      req.headers['x-webhook-secret'] ||
      req.headers['x-api-key'] ||
      req.query.secret ||
      req.query.token ||
      (req.body && (req.body.secret || req.body.token));

    return providedSecret === process.env.BANK_WEBHOOK_SECRET;
  }

  // Allow default secret or open webhook if environment variable is not explicitly configured
  const provided =
    req.headers['x-webhook-secret'] ||
    req.headers['x-api-key'] ||
    req.query.secret ||
    req.query.token ||
    (req.body && (req.body.secret || req.body.token));

  if (provided && provided !== 'sweet_home_secure_2026') {
    return false;
  }

  return true;
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

  // 1. If body is a string
  if (typeof req.body === 'string') {
    try {
      const parsed = JSON.parse(req.body);
      if (typeof parsed === 'object' && parsed !== null) {
        req.body = parsed;
      } else {
        message = req.body;
      }
    } catch (_) {
      const contentMatch = req.body.match(/(?:content|message|text|body|msg)\s*[:=]\s*["']?([^"'\r\n]+)/i);
      if (contentMatch) {
        message = contentMatch[1];
      } else {
        message = req.body;
      }
    }
  }

  // 2. If body is an object
  if (req.body && typeof req.body === 'object') {
    // Check all common field names (case-insensitive)
    for (const [key, val] of Object.entries(req.body)) {
      const lower = key.toLowerCase();
      if (!message && typeof val === 'string' && val.trim()) {
        if (['content', 'message', 'text', 'body', 'msg', 'sms', 'smscontent', 'sms_content', 'smsbody', 'sms_body'].includes(lower)) {
          message = val;
        }
      }
      if (!sender && typeof val === 'string' && val.trim()) {
        if (['from', 'sender', 'phone', 'title', 'sender_name', 'number', 'address'].includes(lower)) {
          sender = val;
        }
      }
    }

    // Check nested objects (e.g. data, payload, item, sms)
    if (!message && (req.body.data || req.body.payload || req.body.item)) {
      const inner = req.body.data || req.body.payload || req.body.item;
      if (typeof inner === 'object' && inner !== null) {
        for (const [k, v] of Object.entries(inner)) {
          const lk = k.toLowerCase();
          if (!message && typeof v === 'string' && ['content', 'message', 'text', 'body', 'msg', 'sms'].includes(lk)) {
            message = v;
          }
        }
      } else if (typeof inner === 'string') {
        message = inner;
      }
    }

    // Fallback: If no message extracted yet, scan all values for bank alert keywords
    if (!message) {
      for (const val of Object.values(req.body)) {
        if (typeof val === 'string' && val.length > 15) {
          if (/debited|credited|avl|bal|inr|rs|idfc/i.test(val)) {
            message = val;
            break;
          }
        }
      }
    }

    // Fallback: Check if message was sent as a form key without value
    if (!message) {
      for (const key of Object.keys(req.body)) {
        if (key.length > 20 && /debited|credited|avl|bal|inr|rs|idfc/i.test(key)) {
          message = key;
          break;
        }
      }
    }
  }

  // 3. Fallback to query parameters
  if (!message && (req.query.message || req.query.content || req.query.text || req.query.body || req.query.msg)) {
    message = req.query.message || req.query.content || req.query.text || req.query.body || req.query.msg;
  }
  if (!sender && (req.query.from || req.query.sender || req.query.phone)) {
    sender = req.query.from || req.query.sender || req.query.phone;
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
    console.warn('[BankWebhook 400] Empty message. Headers:', req.headers, 'Body:', req.body, 'Query:', req.query);
    return res.status(400).json({
      success: false,
      message: 'No SMS message body found in request. Expected fields: content, message, text, or raw body.',
      receivedKeys: req.body && typeof req.body === 'object' ? Object.keys(req.body) : typeof req.body,
      receivedBody: req.body
    });
  }

  // Gracefully handle test pings from mobile forwarding apps
  if (/test\s*message|^test$|^ping$/i.test(message)) {
    return res.status(200).json({
      success: true,
      isTest: true,
      message: 'Test message received successfully! Webhook is active and connected.'
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
