const BankBalance = require('../models/BankBalance');
const BankTransaction = require('../models/BankTransaction');

const BANK_NAME = 'IDFC FIRST Bank';

/**
 * Security gatekeeper: Checks if SMS contains OTPs, verification codes, or sensitive auth data.
 */
function isOtpOrSensitiveMessage(text) {
  if (!text || typeof text !== 'string') return false;

  const sensitivePatterns = [
    /\b(?:OTP|O\.T\.P|One\s*Time\s*Password)\b/i,
    /\b(?:verification\s*code|security\s*code|auth(?:entication)?\s*code)\b/i,
    /\b(?:secret\s*code|login\s*code|access\s*code)\b/i,
    /\b(?:do\s*not\s*share|never\s*share)\b/i,
    /\b(?:cvv|card\s*verification)\b/i,
    /\b(?:valid\s*for\s*[0-9]+\s*(?:mins?|minutes?|secs?|seconds?))\b/i,
    /\b(?:password\s*reset|temporary\s*password)\b/i,
    /\b(?:debit\s*card\s*PIN|ATM\s*PIN|green\s*PIN)\b/i,
    /\b(?:mandate\s*approval\s*code|request\s*code)\b/i
  ];

  return sensitivePatterns.some((pattern) => pattern.test(text));
}

/**
 * Parses IDFC FIRST Bank SMS text to extract balance, amount, type, UTR, account, and payee.
 */
function parseBankSms(text, sender = '') {
  if (!text || typeof text !== 'string') {
    return {
      isValid: false,
      error: 'Empty or invalid SMS text'
    };
  }

  const cleanText = text.replace(/[\r\n]+/g, ' ').trim();

  // Security gatekeeper: Strictly reject and drop OTPs, PINs, and authentication messages
  if (isOtpOrSensitiveMessage(cleanText)) {
    return {
      isValid: false,
      isSensitive: true,
      error: 'Security gatekeeper: OTP or authentication message detected and discarded.'
    };
  }

  // 1. Transaction Type (DEBIT vs CREDIT)
  let type = 'UNKNOWN';
  if (/\b(?:debited|debit|withdrawn|spent|sent|paid|transferred|purchased)\b/i.test(cleanText)) {
    type = 'DEBIT';
  } else if (/\b(?:credited|credit|deposited|received|added|refunded)\b/i.test(cleanText)) {
    type = 'CREDIT';
  }

  // 2. Transaction Amount
  // Matches: "debited for Rs 500", "debited by INR 500", "spent Rs.120"
  // OR "INR 450.00 debited", "Rs 500 credited", "₹1,200 has been debited"
  let amount = 0;
  const amtPattern1 = /(?:debited|credited|spent|transferred|deposited|sent|withdrawn|paid|received)\s*(?:by|for|of|with|amounting\s*to)?\s*(?:(?:is|INR|Rs\.?|₹)\s*)*([0-9,]+(?:\.[0-9]{1,2})?)/i;
  const amtPattern2 = /(?:INR|Rs\.?|₹)\s*([0-9,]+(?:\.[0-9]{1,2})?)\s*(?:has\s*been|is|was)?\s*(?:debited|credited|spent|transferred|deposited|sent|withdrawn|paid|received)/i;
  const amtPattern3 = /(?:INR|Rs\.?|₹)\s*([0-9,]+(?:\.[0-9]{1,2})?)/i;

  let amtMatch = cleanText.match(amtPattern1) || cleanText.match(amtPattern2);
  if (!amtMatch && type !== 'UNKNOWN') {
    amtMatch = cleanText.match(amtPattern3);
  }
  if (amtMatch && amtMatch[1]) {
    amount = parseFloat(amtMatch[1].replace(/,/g, ''));
  }

  // 3. Available Balance
  // Matches: "Avl Bal: INR 48,250.00", "Total Avl Bal Rs 50,000", "Available Balance: ₹45,000", "Bal: INR 40,000", "closing balance is Rs 3000"
  const balPatterns = [
    /(?:(?:Total\s*|Net\s*)?Avl(?:able|\.)?\s*Bal(?:ance)?|Available\s*balance|Clear\s*balance|closing\s*balance|balance\s*in\s*A\/c|account\s*balance)[\s:.-]*(?:(?:is|of|INR|Rs\.?|₹)\s*)*([0-9,]+(?:\.[0-9]{1,2})?)/i,
    /(?:INR|Rs\.?|₹)\s*([0-9,]+(?:\.[0-9]{1,2})?)\s*(?:is\s*(?:the\s*)?)?(?:available|avl\b)/i,
    /\b(?:Bal|Balance)[\s:.-]+(?:(?:is|of|INR|Rs\.?|₹)\s*)*([0-9,]+(?:\.[0-9]{1,2})?)/i
  ];

  let rawBalance = null;
  for (const pattern of balPatterns) {
    const match = cleanText.match(pattern);
    if (match && match[1]) {
      rawBalance = match[1];
      break;
    }
  }
  const balance = rawBalance ? parseFloat(rawBalance.replace(/,/g, '')) : null;

  // 4. Account Number (e.g. "...4321", "ending 4321", "XX4321", "A/c 4321", "Card ending 4321")
  const acctPatterns = [
    /(?:ending\s*(?:with|in)?\s*(?:no\.?)?)\s*([0-9]{4})\b/i,
    /(?:A\/C|Account|Acct|A\/c\s*no\.?)[^0-9]*([0-9]{4})\b/i,
    /\b(?:X+|\.{3,})([0-9]{4})\b/i,
    /Card\s*(?:ending)?\s*([0-9]{4})\b/i
  ];

  let accountLast4 = '';
  for (const pattern of acctPatterns) {
    const match = cleanText.match(pattern);
    if (match && match[1]) {
      accountLast4 = match[1];
      break;
    }
  }

  // 5. Reference / UTR / RRN
  const refMatch = cleanText.match(/(?:UPI\s*Ref(?:\s*no\.?)?|Ref(?:\s*no\.?|\s*id)?|Reference\s*no\.?|UTR|RRN)[:\s-]*([A-Za-z0-9_\/-]+)/i);
  let reference = refMatch ? refMatch[1].trim() : '';
  if (reference.endsWith('.')) reference = reference.slice(0, -1);

  // 6. Payee / Beneficiary / Recipient Extraction ("To whom it was sent")
  let recipient = '';
  // Pattern A: "; Mr Harish Ragavendar credited" (IDFC Bank debit format)
  const idfcPeerCreditedMatch = cleanText.match(/;\s*([A-Za-z0-9\s.]{2,40}?)\s+credited\b/i);
  // Pattern B: "; Mr Harish Ragavendar debited" (IDFC Bank credit format)
  const idfcPeerDebitedMatch = cleanText.match(/;\s*([A-Za-z0-9\s.]{2,40}?)\s+debited\b/i);
  const paidToMatch = cleanText.match(/\b(?:paid|sent|transferred)\s+to\s+(?:VPA\s+|UPI\s+ID\s+)?([A-Za-z0-9@_./ -]{2,40})/i);
  const towardsMatch = cleanText.match(/\btowards\s+(?:UPI\/)?([A-Za-z0-9@_./ -]{2,40})/i);
  const toMatch = cleanText.match(/\bto\s+(?:VPA\s+|UPI\s+ID\s+)?(?!your|a\/c|account)([A-Za-z0-9@_./ -]{2,40})/i);
  const atMatch = cleanText.match(/\bat\s+([A-Za-z0-9@_./ -]{2,40})/i);
  const infoMatch = cleanText.match(/\binfo[:\s-]+([A-Za-z0-9@_./ -]{2,40})/i);
  const fromMatch = cleanText.match(/\b(?:from|received\s+from)\s+(?!your|a\/c|account)([A-Za-z0-9@_./ -]{2,40})/i);
  const byMatch = cleanText.match(/\bby\s+(Salary|IMPS|NEFT|UPI|Transfer|Refund|[A-Za-z0-9@_./ -]{2,30})/i);

  const candidate =
    (type === 'DEBIT' ? idfcPeerCreditedMatch : idfcPeerDebitedMatch) ||
    paidToMatch ||
    towardsMatch ||
    (type === 'CREDIT' ? (fromMatch || byMatch) : null) ||
    atMatch ||
    infoMatch ||
    toMatch ||
    fromMatch ||
    byMatch;

  if (candidate && candidate[1]) {
    recipient = candidate[1].trim();

    // Strip trailing boundary words like "on 13-OCT", "Avl Bal", "Bal:", "Ref:", "UPI Ref", "via", "INR", "Rs"
    recipient = recipient.replace(/\s+(?:on\s+[0-9]|on\b|Avl\s*Bal|Total\s*Avl|Bal:|UPI\s*Ref|Ref:|via\b|INR\b|Rs\b|is\b|using\b).*$/i, '').trim();

    // Strip trailing punctuation
    recipient = recipient.replace(/[.,;:-]+$/, '').trim();

    // If it started with "UPI/", strip prefix for clean display
    if (/^UPI\//i.test(recipient)) {
      recipient = recipient.replace(/^UPI\//i, '').trim();
    }
  }

  // Reject if captured string is purely numbers or currency (e.g. "Rs 450")
  if (/^(?:INR|Rs\.?|₹)?\s*[0-9]+(?:\.[0-9]+)?$/i.test(recipient)) {
    recipient = '';
  }

  let description = '';
  if (recipient) {
    description = type === 'DEBIT' ? `Paid to ${recipient}` : `Received from ${recipient}`;
  } else {
    description = type === 'DEBIT' ? 'UPI / Debit Payment' : type === 'CREDIT' ? 'Credit Transfer' : 'Bank SMS Alert';
  }

  return {
    isValid: amount > 0 || balance !== null,
    type,
    amount,
    balance,
    accountLast4: accountLast4 || '4321',
    reference,
    recipient: recipient || (type === 'DEBIT' ? 'Merchant / Payee' : 'Sender / Transfer'),
    description,
    cleanText
  };
}

/**
 * Main processor for incoming SMS forwarder webhook requests
 */
async function processBankSms({ sender = '', message = '', timestamp = null, rawPayload = {}, simulated = false }) {
  const parsed = parseBankSms(message, sender);
  if (parsed.isSensitive) {
    return {
      success: false,
      isSensitive: true,
      ignored: true,
      message: 'Security check: OTP or sensitive authentication message discarded. No data stored.'
    };
  }

  if (!parsed.isValid) {
    return {
      success: false,
      message: 'Could not extract valid transaction amount or balance from SMS.',
      parsed
    };
  }

  // Fetch current stored balance record
  let currentRecord = await BankBalance.findOne({ bankName: BANK_NAME });
  let newBalance = parsed.balance;

  // Fallback: If balance was not explicitly stated in SMS, calculate from current balance
  if (newBalance === null && currentRecord) {
    if (parsed.type === 'DEBIT') {
      newBalance = Math.max(0, currentRecord.balance - parsed.amount);
    } else if (parsed.type === 'CREDIT') {
      newBalance = currentRecord.balance + parsed.amount;
    } else {
      newBalance = currentRecord.balance;
    }
  } else if (newBalance === null) {
    newBalance = parsed.type === 'CREDIT' ? parsed.amount : 0;
  }

  const smsDate = timestamp ? new Date(timestamp) : new Date();
  const accountLast4 = parsed.accountLast4 || currentRecord?.accountLast4 || '****';

  // Update or insert BankBalance
  const updatedBalance = await BankBalance.findOneAndUpdate(
    { bankName: BANK_NAME },
    {
      bankName: BANK_NAME,
      accountLast4,
      balance: newBalance,
      currency: 'INR',
      lastTransactionType: parsed.type,
      lastTransactionAmount: parsed.amount,
      lastRecipient: parsed.recipient || '',
      syncSource: 'SMS',
      lastSmsContent: message,
      lastSender: sender || 'SMS Forwarder',
      lastSyncedAt: smsDate,
      lastSyncStatus: 'SUCCESS',
      lastSyncError: ''
    },
    { upsert: true, new: true }
  );

  // Check for duplicate transaction within 2 minutes to prevent double-posting
  let transactionDoc = null;
  if (parsed.amount > 0) {
    const timeMin = new Date(smsDate.getTime() - 120000);
    const timeMax = new Date(smsDate.getTime() + 120000);

    const existingTxn = await BankTransaction.findOne({
      bankName: BANK_NAME,
      amount: parsed.amount,
      type: parsed.type,
      date: { $gte: timeMin, $lte: timeMax }
    });

    if (!existingTxn) {
      transactionDoc = await BankTransaction.create({
        bankName: BANK_NAME,
        accountLast4,
        type: parsed.type,
        amount: parsed.amount,
        balanceAfter: newBalance,
        recipient: parsed.recipient || '',
        description: parsed.description,
        reference: parsed.reference,
        date: smsDate,
        source: 'SMS',
        rawMessage: message,
        sender: sender || 'SMS Forwarder',
        isDemo: simulated
      });
    } else {
      transactionDoc = existingTxn;
    }
  }

  return {
    success: true,
    message: `SMS received and processed. Updated ${BANK_NAME} balance to ₹${newBalance.toLocaleString('en-IN')}.`,
    data: {
      balance: updatedBalance,
      transaction: transactionDoc,
      parsed
    }
  };
}

/**
 * Get current stored balance
 */
async function getStoredBankBalance() {
  let record = await BankBalance.findOne({ bankName: BANK_NAME });
  if (!record) {
    record = await BankBalance.create({
      bankName: BANK_NAME,
      accountLast4: '****',
      balance: 0,
      currency: 'INR',
      syncSource: 'SMS',
      lastTransactionType: 'UNKNOWN',
      lastTransactionAmount: 0,
      lastRecipient: '',
      lastSyncStatus: 'IDLE',
      lastSyncError: 'Awaiting first bank SMS alert from mobile forwarder app.'
    });
  }
  return record;
}

/**
 * Get transaction history
 */
async function getBankTransactions(limit = 50) {
  return BankTransaction.find({ bankName: BANK_NAME })
    .sort({ date: -1 })
    .limit(limit);
}

module.exports = {
  BANK_NAME,
  parseBankSms,
  processBankSms,
  getStoredBankBalance,
  getBankTransactions
};
