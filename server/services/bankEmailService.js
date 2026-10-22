const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const BankBalance = require('../models/BankBalance');
const BankTransaction = require('../models/BankTransaction');

const BANK_NAME = 'IDFC FIRST Bank';

/**
 * Checks if the configured credentials are dummy/placeholder or empty
 */
function isDummyOrUnset() {
  const user = process.env.BANK_EMAIL_USER || '';
  const pass = process.env.BANK_EMAIL_PASS || '';
  return (
    !user ||
    !pass ||
    user.includes('dummy') ||
    user.includes('example.com') ||
    user.includes('your_') ||
    pass.includes('abcd') ||
    pass.includes('your_')
  );
}

/**
 * Parses IDFC FIRST bank alert email body to extract balance and transaction details
 */
function parseBankEmailContent(text, subject = '') {
  const combined = `${subject}\n${text}`;

  // 1. Available Balance Patterns (IDFC FIRST Bank alert structures)
  const balancePatterns = [
    /(?:(?:Total\s*|Net\s*)?Avl(?:able|\.)?\s*Bal(?:ance)?|Available\s*balance|Clear\s*balance|closing\s*balance|balance\s*in\s*A\/c|account\s*balance)[\s:.-]*(?:(?:is|of|INR|Rs\.?|₹)\s*)*([0-9,]+(?:\.[0-9]{2})?)/i,
    /(?:INR|Rs\.?|₹)\s*([0-9,]+(?:\.[0-9]{2})?)\s*(?:is\s*(?:the\s*)?)?(?:available|avl\b)/i,
    /(?:balance\s*(?:is|:))\s*(?:(?:is|of|INR|Rs\.?|₹)\s*)*([0-9,]+(?:\.[0-9]{2})?)/i
  ];

  let rawBalance = null;
  for (const pattern of balancePatterns) {
    const match = combined.match(pattern);
    if (match && match[1]) {
      rawBalance = match[1];
      break;
    }
  }

  // 2. Account last 4 digits (e.g. "ending with 1234", "XX1234", "A/C ...1234")
  const accountPatterns = [
    /(?:ending\s*(?:with|in)?\s*(?:no\.?)?)\s*([0-9]{4})\b/i,
    /(?:A\/C|Account|Acct|A\/c\s*no\.?)[^0-9]*([0-9]{4})\b/i,
    /\bX+([0-9]{4})\b/i
  ];

  let accountLast4 = '****';
  for (const pattern of accountPatterns) {
    const match = combined.match(pattern);
    if (match && match[1]) {
      accountLast4 = match[1];
      break;
    }
  }

  // 3. Transaction Type (DEBIT vs CREDIT)
  let lastTransactionType = 'UNKNOWN';
  if (/debited|debit\b|withdrawn|spent/i.test(combined)) {
    lastTransactionType = 'DEBIT';
  } else if (/credited|credit\b|deposited|received/i.test(combined)) {
    lastTransactionType = 'CREDIT';
  }

  // 4. Transaction Amount
  let lastTransactionAmount = 0;
  const txnMatch = combined.match(
    /(?:debited|credited|spent|transferred|deposited)\s*(?:by|for|of)?\s*(?:INR|Rs\.?)?\s*([0-9,]+(?:\.[0-9]{2})?)/i
  );
  if (txnMatch && txnMatch[1]) {
    lastTransactionAmount = parseFloat(txnMatch[1].replace(/,/g, ''));
  }

  // 5. Reference / UTR
  const refMatch = combined.match(/(?:Ref(?:erence)?\s*(?:no\.?|id)?|UTR|UPI\s*Ref)[:\s-]*([A-Za-z0-9_-]+)/i);
  const reference = refMatch ? refMatch[1] : '';

  // 6. Description / Payee remarks
  const descMatch = combined.match(/(?:towards|for|at|info|via)\s+([A-Za-z0-9@_./ -]{3,40})/i);
  let description = descMatch ? descMatch[1].trim() : '';
  if (!description) {
    description = lastTransactionType === 'DEBIT' ? 'UPI Payment / Debit' : lastTransactionType === 'CREDIT' ? 'Credit Transfer' : 'Bank Transaction';
  }

  return {
    balance: rawBalance ? parseFloat(rawBalance.replace(/,/g, '')) : null,
    accountLast4,
    lastTransactionType,
    lastTransactionAmount,
    reference,
    description
  };
}

/**
 * Seed realistic demo transactions for display when dummy credentials are active
 */
async function seedDemoTransactionsIfNeeded() {
  // Demo transactions disabled
  return;
}

/**
 * Sync bank balance from email inbox
 */
async function syncBankBalanceFromEmail() {
  // Handle dummy/placeholder credentials gracefully
  if (isDummyOrUnset()) {
    await seedDemoTransactionsIfNeeded();
    const existing = await BankBalance.findOne({ bankName: BANK_NAME });
    return {
      success: false,
      isDummy: true,
      message: `Using placeholder credentials. Add your real Gmail App Password in server/.env to sync with ${BANK_NAME} emails.`,
      data: existing
    };
  }

  const client = new ImapFlow({
    host: process.env.BANK_EMAIL_HOST || 'imap.gmail.com',
    port: parseInt(process.env.BANK_EMAIL_PORT, 10) || 993,
    secure: true,
    auth: {
      user: process.env.BANK_EMAIL_USER,
      pass: process.env.BANK_EMAIL_PASS
    },
    logger: false
  });

  try {
    await client.connect();

    const lock = await client.getMailboxLock('INBOX');
    try {
      const senderDomain = process.env.BANK_SENDER_DOMAIN || 'idfcfirstbank.com';

      // Search for emails from IDFC FIRST Bank
      let messages = await client.search({ from: senderDomain }, { uid: true });

      // Fallback search if sender domain filter returns empty
      if (!messages || messages.length === 0) {
        messages = await client.search(
          { or: [{ body: 'IDFC' }, { subject: 'IDFC' }] },
          { uid: true }
        );
      }

      if (!messages || messages.length === 0) {
        const existing = await BankBalance.findOne({ bankName: BANK_NAME });
        if (existing) {
          existing.lastSyncStatus = 'ERROR';
          existing.lastSyncError = `No emails found matching ${BANK_NAME} in inbox.`;
          await existing.save();
        }
        return {
          success: false,
          message: `No ${BANK_NAME} emails found in inbox.`,
          data: existing
        };
      }

      // Get latest email UID
      const latestUid = messages[messages.length - 1];
      const download = await client.download(latestUid, ['source'], { uid: true });
      const parsed = await simpleParser(download.content);

      const emailText = parsed.text || '';
      const emailSubject = parsed.subject || '';
      const emailDate = parsed.date || new Date();

      const extracted = parseBankEmailContent(emailText, emailSubject);

      if (extracted.balance === null) {
        const existing = await BankBalance.findOne({ bankName: BANK_NAME });
        if (existing) {
          existing.lastSyncStatus = 'ERROR';
          existing.lastSyncError = 'Email found, but could not detect balance text format.';
          await existing.save();
        }
        return {
          success: false,
          message: `Found ${BANK_NAME} email, but could not detect balance text in the email body.`,
          data: existing
        };
      }

      const updated = await BankBalance.findOneAndUpdate(
        { bankName: BANK_NAME },
        {
          bankName: BANK_NAME,
          accountLast4: extracted.accountLast4,
          balance: extracted.balance,
          currency: 'INR',
          lastTransactionType: extracted.lastTransactionType,
          lastTransactionAmount: extracted.lastTransactionAmount,
          lastEmailSubject: emailSubject,
          lastEmailDate: emailDate,
          lastSyncedAt: new Date(),
          lastSyncStatus: 'SUCCESS',
          lastSyncError: ''
        },
        { upsert: true, new: true }
      );

      // Record transaction into history
      if (extracted.lastTransactionAmount > 0) {
        const existingTxn = await BankTransaction.findOne({
          bankName: BANK_NAME,
          amount: extracted.lastTransactionAmount,
          date: { $gte: new Date(emailDate.getTime() - 60000), $lte: new Date(emailDate.getTime() + 60000) }
        });

        if (!existingTxn) {
          const newBal = extracted.balance;
          if (newBal > 0) {
            try {
              const prevTxn = await BankTransaction.findOne({
                bankName: BANK_NAME,
                balanceAfter: { $gt: 0 },
                date: { $lte: emailDate }
              }).sort({ date: -1, _id: -1 });

              let prevBalance = prevTxn ? prevTxn.balanceAfter : null;
              if (!prevBalance) {
                const balDoc = await BankBalance.findOne({ bankName: BANK_NAME });
                if (balDoc && balDoc.balance > 0) prevBalance = balDoc.balance;
              }

              if (prevBalance && prevBalance > 0) {
                const expBal = extracted.lastTransactionType === 'DEBIT'
                  ? Math.round((prevBalance - extracted.lastTransactionAmount) * 100) / 100
                  : Math.round((prevBalance + extracted.lastTransactionAmount) * 100) / 100;
                const gap = Math.round((expBal - newBal) * 100) / 100;

                if (gap >= 1) {
                  const User = require('../models/User');
                  const Expense = require('../models/Expense');
                  const defaultAdmin = (await User.findOne({ role: 'admin' })) || (await User.findOne());
                  const settlerId = defaultAdmin?._id || null;
                  const gapDate = new Date(emailDate.getTime() - 1000);
                  const gapBalAfter = Math.round((prevBalance - gap) * 100) / 100;

                  const gapTxn = await BankTransaction.create({
                    bankName: BANK_NAME,
                    accountLast4: extracted.accountLast4,
                    type: 'DEBIT',
                    amount: gap,
                    balanceAfter: gapBalAfter,
                    recipient: 'Unknown',
                    description: 'UNKNOWN EXPENSE',
                    reference: 'BALANCE_GAP',
                    date: gapDate,
                    emailSubject: `Balance gap of ₹${gap} auto-reconciled`,
                    isDemo: false
                  });

                  if (settlerId) {
                    await Expense.create({
                      amount: gap,
                      category: 'Misc',
                      description: 'UNKNOWN EXPENSE',
                      expenseDate: gapDate,
                      paidBy: settlerId,
                      createdBy: settlerId,
                      bankTransactionRef: gapTxn._id
                    });
                  }
                }
              }
            } catch (emailGapErr) {
              console.error('[BankSync] Error during email gap reconciliation:', emailGapErr);
            }
          }

          await BankTransaction.create({
            bankName: BANK_NAME,
            accountLast4: extracted.accountLast4,
            type: extracted.lastTransactionType,
            amount: extracted.lastTransactionAmount,
            balanceAfter: extracted.balance,
            description: extracted.description || emailSubject || 'Transaction alert',
            reference: extracted.reference || '',
            date: emailDate,
            emailSubject: emailSubject,
            isDemo: false
          });
        }
      }

      return {
        success: true,
        message: `Successfully updated ${BANK_NAME} balance from email.`,
        data: updated
      };
    } finally {
      lock.release();
    }
  } catch (error) {
    console.error(`[BankSync] IMAP Error:`, error.message);
    const existing = await BankBalance.findOne({ bankName: BANK_NAME });
    if (existing) {
      existing.lastSyncStatus = 'ERROR';
      existing.lastSyncError = error.message;
      await existing.save();
    }
    return {
      success: false,
      message: `Failed to connect or fetch from email: ${error.message}`,
      data: existing
    };
  } finally {
    try {
      await client.logout();
    } catch (_) {}
  }
}

/**
 * Get current stored balance without fetching email
 */
async function getStoredBankBalance() {
  if (isDummyOrUnset()) {
    await seedDemoTransactionsIfNeeded();
  }

  let record = await BankBalance.findOne({ bankName: BANK_NAME });
  if (!record) {
    record = await BankBalance.create({
      bankName: BANK_NAME,
      accountLast4: '4321',
      balance: 48250.00,
      currency: 'INR',
      lastSyncStatus: 'IDLE',
      lastSyncError: isDummyOrUnset()
        ? 'Using dummy email credentials. Update server/.env with your real Gmail App Password to start live sync.'
        : 'Not synced yet.'
    });
  }
  return record;
}

/**
 * Get transaction history
 */
async function getBankTransactions(limit = 50) {
  if (isDummyOrUnset()) {
    await seedDemoTransactionsIfNeeded();
  }

  return BankTransaction.find({ bankName: BANK_NAME })
    .sort({ date: -1 })
    .limit(limit);
}

module.exports = {
  syncBankBalanceFromEmail,
  getStoredBankBalance,
  getBankTransactions,
  parseBankEmailContent,
  parseIdbiEmailContent: parseBankEmailContent,
  isDummyOrUnset
};
