const mongoose = require('mongoose');
const BankBalance = require('../models/BankBalance');
const BankTransaction = require('../models/BankTransaction');
const User = require('../models/User');
const FundingCycle = require('../models/FundingCycle');
const { monthKey, istMonthRange, safeParseDate } = require('../utils/time');

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
  if (
    /(?:A\/c|Account|Acct|Card)[^.;]*\bcredited\b/i.test(cleanText) ||
    /\b(?:credited\s*(?:to|by|for)|deposited|received\s*in|refunded)\b/i.test(cleanText)
  ) {
    type = 'CREDIT';
  } else if (
    /(?:A\/c|Account|Acct|Card)[^.;]*\bdebited\b/i.test(cleanText) ||
    /\b(?:debited\s*(?:from|by|for)|withdrawn|spent|transferred|purchased)\b/i.test(cleanText)
  ) {
    type = 'DEBIT';
  } else if (/\b(?:credited|credit|deposited|received|added|refunded)\b/i.test(cleanText)) {
    type = 'CREDIT';
  } else if (/\b(?:debited|debit|withdrawn|spent|sent|paid|transferred|purchased)\b/i.test(cleanText)) {
    type = 'DEBIT';
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
  // Matches: "Avl Bal: INR 48,250.00", "Total Avl Bal Rs 50,000", "Available Balance: ₹45,000", "Bal: INR 40,000", "new balance is INR 226.77"
  const balPatterns = [
    /(?:(?:Total\s*|Net\s*|new\s*)?Avl(?:able|\.)?\s*Bal(?:ance)?|Available\s*balance|Clear\s*balance|new\s*balance|closing\s*balance|balance\s*in\s*A\/c|account\s*balance)[\s:.-]*(?:(?:is|of|INR|Rs\.?|₹)\s*)*([0-9,]+(?:\.[0-9]{1,2})?)/i,
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

  // 4. Account Number (e.g. "...4202", "XXXXX594202", "XX4202", "ending 4202", "Card ending 4202")
  const acctPatterns = [
    /(?:ending\s*(?:with|in)?\s*(?:no\.?)?)\s*([0-9]{4})\b/i,
    /(?:A\/C|Account|Acct|A\/c\s*no\.?)[^0-9]*(?:X+|\.{2,})?[0-9]*([0-9]{4})\b/i,
    /(?:X+|\.{2,})[0-9]*([0-9]{4})\b/i,
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

    // Strip trailing boundary words like "from A/c", "on 13-OCT", "Avl Bal", "Bal:", "Ref:", "UPI Ref", "via", "INR", "Rs"
    recipient = recipient.replace(/\s+(?:from\b|on\s+[0-9]|on\b|for\b|with\b|Avl\s*Bal|Total\s*Avl|Bal[:.]?|Balance|UPI\s*Ref|Ref:|via\b|INR\b|Rs\b|is\b|using\b).*$/i, '').trim();

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
    accountLast4: accountLast4 || '4202',
    reference,
    recipient: recipient || (type === 'DEBIT' ? 'Merchant / Payee' : 'Sender / Transfer'),
    description,
    cleanText
  };
}

/**
 * Bigram Dice coefficient similarity: measures character overlap between two strings (0.0 - 1.0).
 * Handles typos, spelling differences, and truncated names without needing hardcoded lists.
 */
function getDiceCoefficient(s1, s2) {
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1;
  if (s1.length < 2 || s2.length < 2) return 0;
  const bigrams1 = [];
  for (let i = 0; i < s1.length - 1; i++) bigrams1.push(s1.substring(i, i + 2));
  const bigrams2 = [];
  for (let i = 0; i < s2.length - 1; i++) bigrams2.push(s2.substring(i, i + 2));
  let matches = 0;
  const set2 = [...bigrams2];
  for (const b of bigrams1) {
    const idx = set2.indexOf(b);
    if (idx !== -1) {
      matches++;
      set2.splice(idx, 1);
    }
  }
  return (2 * matches) / (bigrams1.length + bigrams2.length);
}

/**
 * Finds the length of the longest common substring between two strings.
 */
function longestCommonSubstringLength(s1, s2) {
  if (!s1 || !s2) return 0;
  let maxLen = 0;
  for (let i = 0; i < s1.length; i++) {
    for (let len = 3; i + len <= s1.length; len++) {
      const sub = s1.substr(i, len);
      if (s2.includes(sub)) {
        if (len > maxLen) maxLen = len;
      }
    }
  }
  return maxLen;
}

/**
 * Known housemate aliases and nicknames (optional speedup & fallback).
 */
const HOUSEMATE_ALIASES = {
  bala: ['bala', 'balamurugan', 'murugan'],
  veera: ['veera', 'veeraprasanth', 'prasanth'],
  harish: ['harish', 'ragavendar', 'harishragavendar'],
  gowtham: ['gowtham', 'selvan', 'gowthamselvan', 'gautham'],
  ashwin: ['ashwin', 'ashwinj'],
  jegan: ['jegan', 'arockia', 'arockiajegan', 'arokia'],
  dhanesh: ['dhanesh', 'dhanes', 'dhaneswar', 'dhaneshwar', 'dhaneswaran', 'dhaneshwaran', '8248441796'],
  dhanes: ['dhanesh', 'dhanes', 'dhaneswar', 'dhaneshwar', 'dhaneswaran', 'dhaneshwaran', '8248441796'],
  bhuvi: ['bhuvanesh', 'bhuvi', 'psbhuvi', 'bhuvan'],
  bhuvanesh: ['bhuvanesh', 'bhuvi', 'psbhuvi', 'bhuvan'],
  akash: ['akash']
};

/**
 * Dynamically extracts all searchable tokens from any housemate (name, UPI ID, phone).
 * Works dynamically for anyone added to the database now or in the future.
 */
function getPersonTokens(person) {
  const tokens = new Set();
  const rawName = String(person?.name || '').trim().toLowerCase();
  rawName.split(/[^a-z0-9]+/).filter((w) => w.length >= 3).forEach((w) => tokens.add(w));
  const cleanName = rawName.replace(/[^a-z0-9]/g, '');
  if (cleanName.length >= 3) {
    tokens.add(cleanName);
    if (HOUSEMATE_ALIASES[cleanName]) {
      HOUSEMATE_ALIASES[cleanName].forEach((a) => tokens.add(a));
    }
  }

  const upi = String(person?.upiId || '').trim().toLowerCase();
  if (upi) {
    const handle = upi.split('@')[0] || '';
    handle.split(/[^a-z0-9]+/).filter((w) => w.length >= 3).forEach((w) => tokens.add(w));
    const letters = handle.replace(/[^a-z]/g, '');
    if (letters.length >= 3) tokens.add(letters);
    const nums = handle.match(/[0-9]{5,}/g);
    if (nums) nums.forEach((n) => tokens.add(n));
  }

  const phone = String(person?.phone || '').replace(/[^0-9]/g, '');
  if (phone.length >= 10) tokens.add(phone.slice(-10));

  return Array.from(tokens);
}

/**
 * Universal Partial Matcher: Matches any person even if only a small part / substring appears in UPI or SMS.
 * Uses:
 * 1. Substring & word containment (e.g. 'bala' in 'balamurugan', 'dhanes' in 'dhaneswar')
 * 2. Shared prefix matching (3+ characters)
 * 3. Longest common substring (LCS >= 3)
 * 4. Dice bigram similarity (handles typos, single-letter differences like 'gowtham' vs 'gautham')
 * 5. 10-digit phone / UPI handle matching
 */
const BANK_STOPWORDS_REGEX = /\b(?:balance|bal|available|avl|debited|debit|credited|credit|account|acct|idfc|first|bank|transfer|deposited|received|payment|inr|rs|rrn|upi|ref|towards|amount|clear|closing|customer|team|sender)\b/gi;

function matchPersonScore(person, recipientText = '', messageText = '') {
  const normRecipient = String(recipientText || '').toLowerCase().replace(BANK_STOPWORDS_REGEX, ' ');
  const normMessage = String(messageText || '').toLowerCase().replace(BANK_STOPWORDS_REGEX, ' ');
  const combined = (normRecipient + ' ' + normMessage).replace(/[^a-z0-9]/g, ' ');
  const compact = (normRecipient + ' ' + normMessage).replace(/[^a-z0-9]/g, '');

  const recipWords = normRecipient.split(/[^a-z0-9]+/).filter((w) => w.length >= 3);
  const allWords = combined.split(/[^a-z0-9]+/).filter((w) => w.length >= 3);

  const tokens = getPersonTokens(person);
  let bestScore = 0;

  for (const tok of tokens) {
    if (tok.length < 3) continue;

    // 1. Exact token match in recipient words
    if (recipWords.includes(tok)) {
      bestScore = Math.max(bestScore, 100);
      continue;
    }

    // 2. Exact word boundary in message or recipient
    const wordRegex = new RegExp('(?:^|\\s)' + tok + '(?:$|\\s)', 'i');
    if (wordRegex.test(combined)) {
      bestScore = Math.max(bestScore, 95);
      continue;
    }

    // 3. 10-digit Phone number match
    if (/^[0-9]{10}$/.test(tok) && compact.includes(tok)) {
      bestScore = Math.max(bestScore, 100);
      continue;
    }

    // 4. Universal partial matching: check against all words in recipient and SMS
    for (const rw of recipWords) {
      // Substring containment (e.g. 'dhanes' in 'dhaneswar', 'bala' in 'balamurugan')
      if (rw.includes(tok) || tok.includes(rw)) {
        const shorter = Math.min(rw.length, tok.length);
        const longer = Math.max(rw.length, tok.length);
        const score = Math.round(75 + (shorter / longer) * 20); // 75 - 95
        bestScore = Math.max(bestScore, score);
      }

      // Shared prefix of 3+ letters (e.g. 'bhuv' in 'bhuvanesh' and 'bhuvi')
      let prefixLen = 0;
      while (prefixLen < rw.length && prefixLen < tok.length && rw[prefixLen] === tok[prefixLen]) {
        prefixLen++;
      }
      if (prefixLen >= 3) {
        bestScore = Math.max(bestScore, Math.min(90, 60 + prefixLen * 7));
      }

      // Longest Common Substring >= 3 (e.g. 'senth' in 'senthilkumar')
      const lcs = longestCommonSubstringLength(rw, tok);
      if (lcs >= 4) {
        bestScore = Math.max(bestScore, Math.min(85, 55 + lcs * 7));
      }

      // Fuzzy spelling similarity (Dice coefficient) e.g. 'gowtham' vs 'gautham'
      const dice = getDiceCoefficient(rw, tok);
      if (dice >= 0.45) {
        bestScore = Math.max(bestScore, Math.round(dice * 90));
      }
    }

    // 5. Token is present inside compact SMS string
    if (compact.includes(tok)) {
      bestScore = Math.max(bestScore, 75);
    }
  }

  return bestScore;
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

  const smsDate = safeParseDate(timestamp);
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
      // ─── BALANCE RECONCILIATION & UNKNOWN EXPENSE GAP FILL ───
      // Look for previous balance, if that matches add,
      // otherwise add an Expense for that gap named "UNKNOWN EXPENSE", then add coming expense
      if (newBalance > 0) {
        try {
          // Find the latest previous transaction with a valid balanceAfter on or before this smsDate
          const prevTxn = await BankTransaction.findOne({
            bankName: BANK_NAME,
            balanceAfter: { $gt: 0 },
            date: { $lte: smsDate }
          }).sort({ date: -1, _id: -1 });

          let prevBalance = prevTxn ? prevTxn.balanceAfter : null;

          // If no previous transaction with balanceAfter found, check current BankBalance
          if (prevBalance === null || prevBalance === undefined) {
            const curBalDoc = await BankBalance.findOne({ bankName: BANK_NAME });
            if (curBalDoc && curBalDoc.balance > 0) {
              prevBalance = curBalDoc.balance;
            }
          }

          if (prevBalance && prevBalance > 0) {
            // Expected balance after this transaction
            const expectedBalance = parsed.type === 'DEBIT'
              ? Math.round((prevBalance - parsed.amount) * 100) / 100
              : Math.round((prevBalance + parsed.amount) * 100) / 100;

            // Gap is the difference between what balance should be vs what SMS actually reported
            const gap = Math.round((expectedBalance - newBalance) * 100) / 100;

            // If gap >= 1, money left the account unrecorded -> Add UNKNOWN EXPENSE for that gap first
            if (gap >= 1) {
              const Expense = require('../models/Expense');
              const audit = require('./auditService');
              const defaultAdmin = (await User.findOne({ role: 'admin' })) || (await User.findOne());
              const settlerId = defaultAdmin?._id || null;

              const gapDate = new Date(smsDate.getTime() - 1000); // 1 sec before coming expense
              const gapBalanceAfter = Math.round((prevBalance - gap) * 100) / 100;

              const gapTxnDoc = await BankTransaction.create({
                bankName: BANK_NAME,
                accountLast4,
                type: 'DEBIT',
                amount: gap,
                balanceAfter: gapBalanceAfter,
                recipient: 'Unknown',
                description: 'UNKNOWN EXPENSE',
                reference: 'BALANCE_GAP',
                date: gapDate,
                source: 'SMS',
                rawMessage: `Auto-reconciled: Detected unrecorded balance gap of ₹${gap} before incoming ${parsed.type} of ₹${parsed.amount}. (Previous balance: ₹${prevBalance}, Expected: ₹${expectedBalance}, Actual: ₹${newBalance}).`,
                sender: 'SweetHome Reconciler',
                isDemo: simulated
              });

              let gapExpenseDoc = null;
              if (settlerId) {
                gapExpenseDoc = await Expense.create({
                  amount: gap,
                  category: 'Misc',
                  description: 'UNKNOWN EXPENSE',
                  expenseDate: gapDate,
                  paidBy: settlerId,
                  createdBy: settlerId,
                  bankTransactionRef: gapTxnDoc._id
                });

                await audit.log({
                  action: 'EXPENSE_CREATED',
                  performedBy: settlerId,
                  details: {
                    amount: gap,
                    category: 'Misc',
                    description: 'UNKNOWN EXPENSE',
                    reason: 'Auto-reconciled unrecorded balance gap',
                    previousBalance: prevBalance,
                    expectedBalance,
                    actualBalance: newBalance,
                    gapTransactionId: gapTxnDoc._id,
                    gapExpenseId: gapExpenseDoc._id
                  }
                });
              }

              parsed.reconciledGap = {
                gapAmount: gap,
                previousBalance: prevBalance,
                expectedBalance,
                actualBalance: newBalance,
                gapTransactionId: gapTxnDoc._id,
                gapExpenseId: gapExpenseDoc?._id
              };

              console.log(`[BankSync] Balance gap detected: Created UNKNOWN EXPENSE of ₹${gap} (Prev: ₹${prevBalance} -> Gap Bal: ₹${gapBalanceAfter} -> Incoming: ₹${newBalance})`);
            } else if (gap <= -1) {
              const audit = require('./auditService');
              const defaultAdmin = (await User.findOne({ role: 'admin' })) || (await User.findOne());
              const settlerId = defaultAdmin?._id || null;

              const creditGap = Math.abs(gap);
              const gapDate = new Date(smsDate.getTime() - 1000); // 1 sec before coming transaction
              const gapBalanceAfter = Math.round((prevBalance + creditGap) * 100) / 100;

              const gapTxnDoc = await BankTransaction.create({
                bankName: BANK_NAME,
                accountLast4,
                type: 'CREDIT',
                amount: creditGap,
                balanceAfter: gapBalanceAfter,
                recipient: 'Sender / Deposit',
                description: 'UNKNOWN CREDIT',
                reference: 'BALANCE_GAP',
                date: gapDate,
                source: 'SMS',
                rawMessage: `Auto-reconciled: Detected unrecorded balance surplus of ₹${creditGap} before incoming ${parsed.type} of ₹${parsed.amount}. (Previous balance: ₹${prevBalance}, Expected: ₹${expectedBalance}, Actual: ₹${newBalance}).`,
                sender: 'SweetHome Reconciler',
                isDemo: simulated
              });

              if (settlerId) {
                await audit.log({
                  action: 'BANK_TRANSACTION_RECONCILED',
                  performedBy: settlerId,
                  details: {
                    amount: creditGap,
                    type: 'CREDIT',
                    description: 'UNKNOWN CREDIT',
                    reason: 'Auto-reconciled unrecorded balance surplus',
                    previousBalance: prevBalance,
                    expectedBalance,
                    actualBalance: newBalance,
                    gapTransactionId: gapTxnDoc._id
                  }
                });
              }

              parsed.reconciledGap = {
                gapAmount: creditGap,
                gapType: 'CREDIT',
                previousBalance: prevBalance,
                expectedBalance,
                actualBalance: newBalance,
                gapTransactionId: gapTxnDoc._id
              };

              console.log(`[BankSync] Balance surplus detected: Created UNKNOWN CREDIT of ₹${creditGap} (Prev: ₹${prevBalance} -> Gap Bal: ₹${gapBalanceAfter} -> Incoming: ₹${newBalance})`);
            }
          }
        } catch (gapErr) {
          console.error('[BankSync] Error during balance reconciliation gap check:', gapErr);
        }
      }

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

      // Auto-match Redeem payout on bank DEBIT (prevents duplicate expense from Website + SMS)
      if (parsed.type === 'DEBIT' && parsed.amount > 0) {
        try {
          const Redeem = require('../models/Redeem');
          const Expense = require('../models/Expense');
          const audit = require('./auditService');
          const recipientText = String(parsed.recipient || '').toLowerCase();
          const messageText = String(message || '').toLowerCase();

          // 1. Check if an OPEN Redeem request matches BOTH this payout amount AND the person's name or UPI
          const openRedeems = await Redeem.find({ closed: false, amount: parsed.amount }).populate('createdBy', 'name upiId phone');

          let matchedRedeem = null;
          let matchedGroup = null;

          // Candidate must match person's name or UPI (score >= 60)
          let bestSingleScore = 0;
          for (const r of openRedeems) {
            const score = matchPersonScore(r.createdBy, recipientText, messageText);
            const upiHandle = r.upiId ? r.upiId.toLowerCase().split('@')[0] : '';
            const upiMatch = upiHandle && upiHandle.length >= 3 && messageText.includes(upiHandle);
            const effectiveScore = upiMatch ? 100 : score;

            if (effectiveScore >= 60 && effectiveScore > bestSingleScore) {
              bestSingleScore = effectiveScore;
              matchedRedeem = r;
            }
          }

          // If no single open redeem matched both amount and name, check combined group sum where person matches
          if (!matchedRedeem) {
            const allOpen = await Redeem.find({ closed: false }).populate('createdBy', 'name upiId phone');
            const groupsByPerson = new Map();
            for (const r of allOpen) {
              const pId = String(r.createdBy?._id || r.createdBy || 'unknown');
              if (!groupsByPerson.has(pId)) {
                groupsByPerson.set(pId, { user: r.createdBy, items: [], total: 0 });
              }
              const g = groupsByPerson.get(pId);
              g.items.push(r);
              g.total += Number(r.amount) || 0;
            }

            const candidateGroups = Array.from(groupsByPerson.values()).filter((g) => g.total === parsed.amount);
            let bestGroupScore = 0;
            for (const g of candidateGroups) {
              const score = matchPersonScore(g.user, recipientText, messageText);
              const upiHandle = g.user?.upiId ? g.user.upiId.toLowerCase().split('@')[0] : '';
              const upiMatch = upiHandle && upiHandle.length >= 3 && messageText.includes(upiHandle);
              const effectiveScore = upiMatch ? 100 : score;

              if (effectiveScore >= 60 && effectiveScore > bestGroupScore) {
                bestGroupScore = effectiveScore;
                matchedGroup = g;
              }
            }
          }

          const defaultAdmin = (await User.findOne({ role: 'admin' })) || (await User.findOne());
          const settlerId = (defaultAdmin && mongoose.Types.ObjectId.isValid(defaultAdmin._id)) ? defaultAdmin._id : null;

          if (matchedRedeem) {
            // Auto-settle single open redeem request
            matchedRedeem.closed = true;
            matchedRedeem.closedByName = 'Bank SMS (Auto)';
            matchedRedeem.closedBy = settlerId;
            matchedRedeem.closedAt = smsDate;
            matchedRedeem.source = 'SMS';
            matchedRedeem.bankTransactionRef = transactionDoc._id;

            const payerId = settlerId || (matchedRedeem.createdBy?._id && mongoose.Types.ObjectId.isValid(matchedRedeem.createdBy._id) ? matchedRedeem.createdBy._id : null);
            let expenseDoc = null;
            if (payerId) {
              expenseDoc = await Expense.create({
                amount: matchedRedeem.amount,
                category: 'Misc',
                description: matchedRedeem.note ? `Redeem: ${matchedRedeem.note}` : `Redeem payout — ${matchedRedeem.createdBy?.name || 'housemate'}`,
                expenseDate: smsDate,
                paidBy: payerId,
                createdBy: payerId,
                bankTransactionRef: transactionDoc._id,
                redeemRef: matchedRedeem._id
              });
              matchedRedeem.expenseRef = expenseDoc._id;
            }

            await matchedRedeem.save();
            transactionDoc.redeemRef = matchedRedeem._id;
            await transactionDoc.save();

            if (settlerId) {
              await audit.log({
                action: 'REDEEM_CLOSED',
                performedBy: settlerId,
                details: {
                  id: matchedRedeem._id,
                  amount: matchedRedeem.amount,
                  source: 'SMS',
                  autoMatched: true,
                  bankTransactionId: transactionDoc._id,
                  expenseId: expenseDoc?._id
                }
              });
            }

            parsed.matchedRedeem = {
              redeemId: matchedRedeem._id,
              amount: matchedRedeem.amount,
              recipient: matchedRedeem.createdBy?.name,
              autoClosed: true
            };
          } else if (matchedGroup) {
            // Auto-settle FULL COMBINED open requests for this housemate
            const payerId = settlerId || (matchedGroup.user?._id && mongoose.Types.ObjectId.isValid(matchedGroup.user._id) ? matchedGroup.user._id : null);
            const notes = matchedGroup.items.map((it) => it.note).filter(Boolean).join(', ');
            let expenseDoc = null;

            if (payerId) {
              expenseDoc = await Expense.create({
                amount: matchedGroup.total,
                category: 'Misc',
                description: `Redeem payout (${matchedGroup.items.length} items: ${notes || 'purchases'}) — ${matchedGroup.user?.name || 'housemate'}`,
                expenseDate: smsDate,
                paidBy: payerId,
                createdBy: payerId,
                bankTransactionRef: transactionDoc._id,
                redeemRef: matchedGroup.items[0]._id
              });
            }

            for (const item of matchedGroup.items) {
              item.closed = true;
              item.closedByName = 'Bank SMS (Auto)';
              item.closedBy = settlerId;
              item.closedAt = smsDate;
              item.source = 'SMS';
              item.bankTransactionRef = transactionDoc._id;
              if (expenseDoc) item.expenseRef = expenseDoc._id;
              await item.save();
            }

            transactionDoc.redeemRef = matchedGroup.items[0]._id;
            await transactionDoc.save();

            if (settlerId) {
              await audit.log({
                action: 'REDEEM_CLOSED',
                performedBy: settlerId,
                details: {
                  itemCount: matchedGroup.items.length,
                  amount: matchedGroup.total,
                  source: 'SMS',
                  autoMatched: true,
                  combinedPayout: true,
                  recipient: matchedGroup.user?.name,
                  bankTransactionId: transactionDoc._id,
                  expenseId: expenseDoc?._id
                }
              });
            }

            parsed.matchedRedeem = {
              redeemIds: matchedGroup.items.map((it) => it._id),
              amount: matchedGroup.total,
              itemCount: matchedGroup.items.length,
              recipient: matchedGroup.user?.name,
              autoClosed: true,
              combined: true
            };
          } else {
            // 2. Check if a RECENTLY CLOSED Redeem matches (settled on website today, awaiting SMS)
            const startOfDay = new Date(smsDate);
            startOfDay.setHours(0, 0, 0, 0);

            // 2a. Single amount check
            const closedRedeems = await Redeem.find({
              closed: true,
              amount: parsed.amount,
              bankTransactionRef: null,
              closedAt: { $gte: startOfDay }
            }).populate('createdBy', 'name upiId phone');

            let matchedClosed = null;
            let bestClosedScore = 0;
            for (const r of closedRedeems) {
              const score = matchPersonScore(r.createdBy, recipientText, messageText);
              const upiHandle = r.upiId ? r.upiId.toLowerCase().split('@')[0] : '';
              const upiMatch = upiHandle && upiHandle.length >= 3 && messageText.includes(upiHandle);
              const effectiveScore = upiMatch ? 100 : score;

              if (effectiveScore >= 60 && effectiveScore > bestClosedScore) {
                bestClosedScore = effectiveScore;
                matchedClosed = r;
              }
            }

            // 2b. Full combined sum check for recently closed
            let matchedClosedGroup = null;
            if (!matchedClosed) {
              const allRecentlyClosed = await Redeem.find({
                closed: true,
                bankTransactionRef: null,
                closedAt: { $gte: startOfDay }
              }).populate('createdBy', 'name upiId phone');

              const closedGroups = new Map();
              for (const r of allRecentlyClosed) {
                const pId = String(r.createdBy?._id || r.createdBy || 'unknown');
                if (!closedGroups.has(pId)) closedGroups.set(pId, { user: r.createdBy, items: [], total: 0 });
                const g = closedGroups.get(pId);
                g.items.push(r);
                g.total += Number(r.amount) || 0;
              }

              const candidateClosedGroups = Array.from(closedGroups.values()).filter((g) => g.total === parsed.amount);
              let bestClosedGroupScore = 0;
              for (const g of candidateClosedGroups) {
                const score = matchPersonScore(g.user, recipientText, messageText);
                const upiHandle = g.user?.upiId ? g.user.upiId.toLowerCase().split('@')[0] : '';
                const upiMatch = upiHandle && upiHandle.length >= 3 && messageText.includes(upiHandle);
                const effectiveScore = upiMatch ? 100 : score;

                if (effectiveScore >= 60 && effectiveScore > bestClosedGroupScore) {
                  bestClosedGroupScore = effectiveScore;
                  matchedClosedGroup = g;
                }
              }
            }

            if (matchedClosed) {
              // Link bank transaction to single closed redeem
              matchedClosed.bankTransactionRef = transactionDoc._id;
              matchedClosed.source = 'SMS';
              await matchedClosed.save();

              transactionDoc.redeemRef = matchedClosed._id;
              await transactionDoc.save();

              if (matchedClosed.expenseRef && mongoose.Types.ObjectId.isValid(matchedClosed.expenseRef)) {
                await Expense.findByIdAndUpdate(matchedClosed.expenseRef, {
                  bankTransactionRef: transactionDoc._id,
                  redeemRef: matchedClosed._id
                });
              }

              parsed.matchedRedeem = {
                redeemId: matchedClosed._id,
                amount: matchedClosed.amount,
                recipient: matchedClosed.createdBy?.name,
                linkedExisting: true
              };
            } else if (matchedClosedGroup) {
              // Link bank transaction to all items in closed group
              for (const it of matchedClosedGroup.items) {
                it.bankTransactionRef = transactionDoc._id;
                it.source = 'SMS';
                await it.save();
                if (it.expenseRef && mongoose.Types.ObjectId.isValid(it.expenseRef)) {
                  await Expense.findByIdAndUpdate(it.expenseRef, {
                    bankTransactionRef: transactionDoc._id,
                    redeemRef: it._id
                  });
                }
              }

              transactionDoc.redeemRef = matchedClosedGroup.items[0]._id;
              await transactionDoc.save();

              parsed.matchedRedeem = {
                redeemIds: matchedClosedGroup.items.map((it) => it._id),
                amount: matchedClosedGroup.total,
                itemCount: matchedClosedGroup.items.length,
                recipient: matchedClosedGroup.user?.name,
                linkedExisting: true,
                combined: true
              };
            } else {
              // 3. Not a redeem: check if a manual expense of this amount was created today without a bankTransactionRef
              const existingManualExpense = await Expense.findOne({
                amount: parsed.amount,
                bankTransactionRef: null,
                expenseDate: { $gte: startOfDay }
              });

              if (existingManualExpense) {
                existingManualExpense.bankTransactionRef = transactionDoc._id;
                await existingManualExpense.save();
              } else if (settlerId) {
                // Create single expense for general bank debit (e.g. EB bill, groceries, Swiggy)
                await Expense.create({
                  amount: parsed.amount,
                  category: 'Misc',
                  description: parsed.recipient ? `Paid to ${parsed.recipient}` : (parsed.description || 'Bank Debit'),
                  expenseDate: smsDate,
                  paidBy: settlerId,
                  createdBy: settlerId,
                  bankTransactionRef: transactionDoc._id
                });
              }
            }
          }
        } catch (debitErr) {
          console.error('Error auto-processing bank DEBIT in bankSmsService:', debitErr);
        }
      }
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
async function getBankTransactions(limit = 100, month = null) {
  const query = { bankName: BANK_NAME };
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const { start, end } = istMonthRange(month);
    query.date = { $gte: start, $lt: end };
  }

  require('../models/User');
  const Redeem = require('../models/Redeem');

  const transactions = await BankTransaction.find(query)
    .populate({
      path: 'redeemRef',
      populate: { path: 'createdBy', select: 'name avatar upiId' }
    })
    .sort({ date: -1 })
    .limit(limit)
    .lean();

  const txnIds = transactions.map((t) => t._id);
  const allLinkedRedeems = await Redeem.find({ bankTransactionRef: { $in: txnIds } })
    .populate('createdBy', 'name avatar upiId')
    .lean();

  const redeemMap = {};
  for (const r of allLinkedRedeems) {
    const key = String(r.bankTransactionRef);
    if (!redeemMap[key]) redeemMap[key] = [];
    redeemMap[key].push(r);
  }

  return transactions.map((t) => {
    const key = String(t._id);
    const linked = redeemMap[key] || [];
    if (linked.length > 0) {
      t.redeemItems = linked;
      if (!t.redeemRef || typeof t.redeemRef !== 'object') {
        t.redeemRef = linked[0];
      }
    } else if (t.redeemRef && typeof t.redeemRef === 'object') {
      t.redeemItems = [t.redeemRef];
    } else {
      t.redeemItems = [];
    }
    return t;
  });
}

module.exports = {
  BANK_NAME,
  parseBankSms,
  processBankSms,
  getStoredBankBalance,
  getBankTransactions
};
