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
function matchPersonScore(person, recipientText = '', messageText = '') {
  const normRecipient = String(recipientText || '').toLowerCase();
  const normMessage = String(messageText || '').toLowerCase();
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

      // Auto-match staying member rent collection on bank CREDIT
      if (parsed.type === 'CREDIT' && parsed.amount > 0) {
        try {
          const users = await User.find();
          const recipientText = String(parsed.recipient || '').toLowerCase();
          const messageText = String(message || '').toLowerCase();

          // Match member using fuzzy score (handles partial names, UPI handles, aliases)
          let bestUser = null;
          let highestScore = 0;
          for (const u of users) {
            const score = matchPersonScore(u, recipientText, messageText);
            if (score >= 60 && score > highestScore) {
              highestScore = score;
              bestUser = u;
            }
          }

          const matchedUser = bestUser;

          if (matchedUser) {
            const cycle = await FundingCycle.findOne({ month: monthKey() });
            if (cycle) {
              const payment = cycle.payments.find((p) => String(p.user) === String(matchedUser._id));
              if (payment) {
                let currentPaid = 0;
                if (payment.amount > 0) {
                  currentPaid = payment.amount;
                } else if (payment.paid) {
                  currentPaid = cycle.contributionAmount || 6000;
                }

                const target = cycle.contributionAmount || 6000;
                const newTotal = currentPaid + parsed.amount;
                payment.amount = newTotal;
                payment.paid = newTotal >= target;
                payment.paidAt = smsDate;
                payment.recordedBy = matchedUser._id;
                payment.source = 'SMS';

                cycle.totalCollected = cycle.payments.reduce((s, p) => s + (p.amount || 0), 0);
                await cycle.save();

                parsed.matchedMember = {
                  userId: matchedUser._id,
                  name: matchedUser.name,
                  amountCredited: parsed.amount,
                  totalPaid: newTotal,
                  target,
                  paid: payment.paid,
                  due: Math.max(0, target - newTotal)
                };
              }
            }
          }
        } catch (matchErr) {
          console.error('Error auto-crediting funding cycle from SMS:', matchErr);
        }
      }

      // Auto-match Redeem payout on bank DEBIT (prevents duplicate expense from Website + SMS)
      if (parsed.type === 'DEBIT' && parsed.amount > 0) {
        try {
          const Redeem = require('../models/Redeem');
          const Expense = require('../models/Expense');
          const audit = require('./auditService');
          const recipientText = String(parsed.recipient || '').toLowerCase();
          const messageText = String(message || '').toLowerCase();

          // 1. Check if an OPEN Redeem request matches this payout amount (single or combined)
          const openRedeems = await Redeem.find({ closed: false, amount: parsed.amount }).populate('createdBy', 'name upiId phone');

          let matchedRedeem = null;
          let matchedGroup = null;

          if (openRedeems.length === 1) {
            matchedRedeem = openRedeems[0];
          } else if (openRedeems.length > 1) {
            // Pick candidate with highest fuzzy match score for name / UPI / nickname
            let bestItem = null;
            let highestScore = 0;
            for (const r of openRedeems) {
              const score = matchPersonScore(r.createdBy, recipientText, messageText);
              if (score > highestScore) {
                highestScore = score;
                bestItem = r;
              }
            }
            matchedRedeem = bestItem || openRedeems[0];
          }

          // If no single open redeem matched, check if parsed.amount equals the FULL COMBINED AMOUNT for any housemate
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
            if (candidateGroups.length === 1) {
              matchedGroup = candidateGroups[0];
            } else if (candidateGroups.length > 1) {
              // Priority: match person name or UPI handle via fuzzy score
              let bestGroup = null;
              let highestScore = 0;
              for (const g of candidateGroups) {
                const score = matchPersonScore(g.user, recipientText, messageText);
                if (score > highestScore) {
                  highestScore = score;
                  bestGroup = g;
                }
              }
              matchedGroup = bestGroup || candidateGroups[0];
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
            if (closedRedeems.length === 1) {
              matchedClosed = closedRedeems[0];
            } else if (closedRedeems.length > 1) {
              let bestItem = null;
              let highestScore = 0;
              for (const r of closedRedeems) {
                const score = matchPersonScore(r.createdBy, recipientText, messageText);
                if (score > highestScore) {
                  highestScore = score;
                  bestItem = r;
                }
              }
              matchedClosed = bestItem || closedRedeems[0];
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
              if (candidateClosedGroups.length === 1) {
                matchedClosedGroup = candidateClosedGroups[0];
              } else if (candidateClosedGroups.length > 1) {
                let bestG = null;
                let highestScore = 0;
                for (const g of candidateClosedGroups) {
                  const score = matchPersonScore(g.user, recipientText, messageText);
                  if (score > highestScore) {
                    highestScore = score;
                    bestG = g;
                  }
                }
                matchedClosedGroup = bestG || candidateClosedGroups[0];
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
  return BankTransaction.find(query)
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
