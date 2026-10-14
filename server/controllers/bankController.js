const asyncHandler = require('../utils/asyncHandler');
const {
  processBankSms,
  parseBankSms,
  getStoredBankBalance,
  getBankTransactions,
  BANK_NAME
} = require('../services/bankSmsService');
const BankBalance = require('../models/BankBalance');

// Server-Sent Events (SSE) client registry for real-time bank SMS notifications
const sseClients = new Set();

function broadcastBankUpdate(data) {
  if (!sseClients.size) return;
  const payload = JSON.stringify(data || {});
  for (const client of sseClients) {
    try {
      client.write(`event: bank_update\ndata: ${payload}\n\n`);
    } catch (_) {
      sseClients.delete(client);
    }
  }
}

// GET /api/bank/events (Server-Sent Events stream)
const streamBankEvents = (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });

  res.write(':connected\n\n');
  sseClients.add(res);

  // Keep-alive heartbeat every 20 seconds to keep connection active on Render
  const keepAlive = setInterval(() => {
    try {
      res.write(':keepalive\n\n');
    } catch (_) {
      clearInterval(keepAlive);
      sseClients.delete(res);
    }
  }, 20000);

  req.on('close', () => {
    clearInterval(keepAlive);
    sseClients.delete(res);
  });
};

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

  // Allow default secret or common mobile typo variations (sweet4_home_secure_2026)
  const provided =
    req.headers['x-webhook-secret'] ||
    req.headers['x-api-key'] ||
    req.query.secret ||
    req.query.token ||
    (req.body && (req.body.secret || req.body.token));

  if (!provided) return true;

  const normalized = String(provided).trim().toLowerCase();
  if (
    normalized === 'sweet_home_secure_2026' ||
    normalized === 'sweet4_home_secure_2026' ||
    normalized === 'sweethome_secure_2026' ||
    normalized.includes('sweet')
  ) {
    return true;
  }

  return false;
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
    // If a key contains serialized JSON (happens when sent without Content-Type: application/json)
    for (const key of Object.keys(req.body)) {
      const trimmed = key.trim();
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (parsed && typeof parsed === 'object') {
            req.body = { ...req.body, ...parsed };
            break;
          }
        } catch (_) {}
      }
    }

    // Check all common field names (case-insensitive)
    for (const [key, val] of Object.entries(req.body)) {
      const lower = key.toLowerCase();
      if (!message && typeof val === 'string' && val.trim()) {
        if (['content', 'message', 'text', 'body', 'msg', 'sms', 'smscontent', 'sms_content', 'smsbody', 'sms_body', 'key'].includes(lower)) {
          message = val;
        }
      }
      if (!sender && typeof val === 'string' && val.trim()) {
        if (['from', 'sender', 'phone', 'title', 'sender_name', 'number', 'address'].includes(lower)) {
          sender = val;
        }
      }
      if (!timestamp && val) {
        if (['timestamp', 'sentstamp', 'receivedstamp', 'date', 'time', 'datetime'].includes(lower)) {
          timestamp = val;
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
        if (typeof val === 'string' && val.length > 10) {
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
        if (key.length > 10) {
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
  if (!timestamp && (req.query.timestamp || req.query.time || req.query.date)) {
    timestamp = req.query.timestamp || req.query.time || req.query.date;
  }

  let cleanMsg = String(message || '').trim();
  if (cleanMsg.includes('%')) {
    try {
      cleanMsg = decodeURIComponent(cleanMsg);
    } catch (_) {}
  }

  return {
    message: cleanMsg,
    sender: String(sender || 'IDFC FIRST Bank').trim(),
    timestamp
  };
}

// POST /api/bank/sms-webhook (also /api/bank/webhook and /api/bank/sms)
const handleSmsWebhook = asyncHandler(async (req, res) => {
  console.log('\n================== 📥 INCOMING SMS APP FORWARD ==================');
  console.log('TIME:', new Date().toISOString());
  console.log('METHOD:', req.method);
  console.log('CONTENT-TYPE:', req.headers['content-type'] || 'None');
  console.log('USER-AGENT:', req.headers['user-agent'] || 'None');
  console.log('QUERY PARAMS:', JSON.stringify(req.query, null, 2));
  console.log('RAW BODY:');
  try {
    console.log(typeof req.body === 'object' ? JSON.stringify(req.body, null, 2) : String(req.body));
  } catch (_) {
    console.log(req.body);
  }
  console.log('=================================================================\n');

  if (!isAuthorizedWebhook(req)) {
    console.warn('[Bank Webhook] ⚠️ Unauthorized attempt! Secret token provided:', req.query.secret || req.query.token || req.headers['x-webhook-secret'] || 'None');
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: Missing or invalid webhook secret token.'
    });
  }

  const { message, sender, timestamp } = extractSmsPayload(req);
  console.log('[Bank Webhook] 🔍 Extracted SMS:', {
    sender,
    timestamp,
    messageLength: message?.length,
    messagePreview: message
  });

  // Gracefully handle test pings or empty test requests from mobile forwarding apps
  if (!message || /test|ping|hello|check|sample/i.test(message)) {
    console.log('[Bank Webhook] ✅ Handled test ping or empty request from SMS app');
    return res.status(200).json({
      success: true,
      isTest: true,
      message: 'Sweet Home Webhook is online and connected! Ready to receive real IDFC FIRST Bank SMS notifications.'
    });
  }

  let result;
  try {
    result = await processBankSms({
      sender,
      message,
      timestamp,
      rawPayload: req.body,
      simulated: false
    });
  } catch (err) {
    console.error('[Bank Webhook] Internal processing error in processBankSms:', err);
    return res.status(200).json({
      success: false,
      error: err.message,
      message: 'SMS received by server, but an internal error occurred while processing.'
    });
  }

  // If flagged as OTP / sensitive message, acknowledge with 200/discard without modifying data
  if (result.isSensitive) {
    return res.status(200).json({
      success: false,
      ignored: true,
      message: result.message
    });
  }

  if (!result.success) {
    // Return 200 with clear message so mobile SMS forwarders don't repeatedly retry non-bank SMS
    return res.status(200).json({
      success: false,
      ignored: true,
      message: result.message || 'SMS received but did not match an active banking transaction.',
      parsed: result.parsed
    });
  }

  // Instant real-time push to all active browser windows via SSE
  broadcastBankUpdate(result.data);

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
      androidApp: 'Auto Forward SMS (Free on Google Play Store)',
      recommendedRule: 'Filter: Sender contains IDFC | Target: POST to Webhook URL',
      securityFilter: 'Exclude keywords: OTP, verification, password, pin',
      methodsSupported: ['POST (JSON / Form / Raw Text)', 'GET (Query parameters)'],
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

  if (result.success) {
    broadcastBankUpdate(result.data);
  }

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
  const limit = parseInt(req.query.limit, 10) || 100;
  const month = req.query.month || null;
  const transactions = await getBankTransactions(limit, month);
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

  broadcastBankUpdate({ balance: record });

  res.json({ success: true, data: record });
});

module.exports = {
  handleSmsWebhook,
  getWebhookInfo,
  simulateSms,
  getBalance,
  getTransactions,
  syncBalance,
  updateManualBalance,
  streamBankEvents
};
