const HouseSetting = require('../models/HouseSetting');
const { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } = require('../config');
const { todayISTDateString } = require('../utils/time');

async function getTelegramConfig() {
  let doc = await HouseSetting.findOne({ key: 'common_account' });
  if (doc && doc.telegramChatId === '-5311138217') {
    doc.telegramChatId = '-1004345526052';
    try { await doc.save(); } catch (_) {}
  }
  const token = doc?.telegramBotToken || TELEGRAM_BOT_TOKEN || '';
  const chatId = doc?.telegramChatId || TELEGRAM_CHAT_ID || '';
  const enabled = doc?.telegramEnabled !== false;
  return { token, chatId, enabled };
}

async function updateTelegramConfig({ token, chatId, enabled }) {
  let doc = await HouseSetting.findOne({ key: 'common_account' });
  if (!doc) doc = new HouseSetting({ key: 'common_account' });

  if (token !== undefined) doc.telegramBotToken = String(token).trim();
  if (chatId !== undefined) doc.telegramChatId = String(chatId).trim();
  if (enabled !== undefined) doc.telegramEnabled = Boolean(enabled);

  await doc.save();
  return { token: doc.telegramBotToken, chatId: doc.telegramChatId, enabled: doc.telegramEnabled };
}

async function sendTelegramMessage(text) {
  try {
    const { token, chatId, enabled } = await getTelegramConfig();
    if (!enabled || !token || !chatId) return false;

    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(4000),
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML'
      })
    });

    const data = await res.json();
    return data.ok;
  } catch (err) {
    console.error('[telegram] Failed to send message:', err.message);
    return false;
  }
}

async function sendTestMessage(targetToken, targetChatId) {
  const { token: defaultToken, chatId: defaultChatId } = await getTelegramConfig();
  const token = targetToken || defaultToken;
  const chatId = targetChatId || defaultChatId;

  if (!token || !chatId) {
    throw new Error('Telegram Bot Token or Group Chat ID is missing.');
  }

  const text = `🚀 <b>Sweet Home Bot Connected!</b>\n\nYour Sweet Home Telegram bot is now active and ready to deliver live house updates and daily duty schedules! ✨`;
  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML'
    })
  });

  const data = await res.json();
  if (!data.ok) {
    throw new Error(data.description || 'Telegram API returned an error.');
  }
  return true;
}

async function sendTomorrowChoresNotification() {
  const choreService = require('./choreService');
  const { TIMEZONE } = require('../config');
  const tz = TIMEZONE || 'Asia/Kolkata';

  const tomorrowDate = new Date(Date.now() + 86400000);
  const tomorrowWeekday = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: tz }).format(tomorrowDate);
  const tomorrowDateStr = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: tz }).format(tomorrowDate);

  const dayData = await choreService.getDay(tomorrowWeekday);
  if (!dayData) return false;

  const cooking = dayData.cooking?.map((u) => u.name).join(' & ') || 'None';
  const cleaning = dayData.cleaning?.map((u) => u.name).join(', ') || 'None';
  const homeClean = dayData.homeClean?.name || 'None';

  const text = `🌙 <b>Tomorrow's Duty Schedule</b>\n` +
    `📅 <b>${tomorrowWeekday}, ${tomorrowDateStr}</b>\n\n` +
    `🍳 <b>Cooking Team</b>: <b>${cooking}</b>\n` +
    `🧹 <b>Kitchen & Utensils</b>: <b>${cleaning}</b>\n` +
    `🏠 <b>Hall & Common Area</b>: <b>${homeClean}</b>\n\n` +
    `<i>Great food and a clean home keep our brotherhood strong! ❤️</i>`;

  return sendTelegramMessage(text);
}

async function sendRemainingMoneyNotification() {
  const fundingService = require('./fundingService');
  const BankBalance = require('../models/BankBalance');
  const summary = await fundingService.getCurrentSummary();
  const bankDoc = await BankBalance.findOne().sort({ updatedAt: -1 });

  const bankAmount = bankDoc ? bankDoc.balance : summary.balance;
  const bankDetails = bankDoc?.accountLast4 ? ` <i>(${bankDoc.bankName || 'IDFC FIRST Bank'} • XX${bankDoc.accountLast4})</i>` : '';

  const pendingText = summary.partialCount > 0
    ? `⏳ <i>${summary.pendingCount} unpaid, ${summary.partialCount} partial payment(s)</i>`
    : (summary.pendingCount > 0 ? `⏳ <i>${summary.pendingCount} housemate(s) pending payment</i>` : `🎉 <i>All 9 housemates fully paid!</i>`);

  const text = `💰 <b>Household Financial Health Update</b>\n` +
    `📅 <b>Period</b>: ${summary.monthLabel}\n\n` +
    `🏦 <b>Live Bank Remaining Balance</b>: <b>₹${Number(bankAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b>${bankDetails}\n\n` +
    `💵 <b>Total Collected</b>: ₹${summary.totalCollected.toLocaleString('en-IN')} <i>(${summary.paidCount}/9 Paid)</i>\n` +
    `💸 <b>Total Spent</b>: ₹${summary.totalSpent.toLocaleString('en-IN')}\n\n` +
    pendingText;

  return sendTelegramMessage(text);
}

async function sendNewRedeemNotification(redeemItem) {
  const Redeem = require('../models/Redeem');
  const User = require('../models/User');

  let item = redeemItem;
  if (typeof item === 'string' || item instanceof String) {
    item = await Redeem.findById(item).populate('createdBy', 'name');
  } else if (item && item._id) {
    const existing = await Redeem.findById(item._id).populate('createdBy', 'name');
    if (existing) item = existing;
  }

  if (!item) return false;

  let requesterName = 'A housemate';
  if (item.createdBy && item.createdBy.name) {
    requesterName = item.createdBy.name;
  } else if (item.createdBy) {
    const u = await User.findById(item.createdBy).select('name');
    if (u) requesterName = u.name;
  }

  const amountStr = Number(item.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const noteStr = item.note ? `\n📝 <b>Purpose</b>: ${item.note}` : '';

  const text = `🤝 <b>New Reimbursement Request Created!</b>\n\n` +
    `👤 <b>Requested By</b>: <b>${requesterName}</b>\n` +
    `💰 <b>Amount</b>: <b>₹${amountStr}</b>\n` +
    `💳 <b>UPI ID</b>: <code>${item.upiId}</code> <i>(Tap to copy)</i>${noteStr}\n\n` +
    `Hi <b>Ashwin</b>! 👋 Please kindly check when you get a moment to settle the payout! ✨`;

  return sendTelegramMessage(text);
}

async function sendRedeemClosedNotification(redeemItem, closedByName) {
  const Redeem = require('../models/Redeem');
  const User = require('../models/User');

  let item = redeemItem;
  if (typeof item === 'string' || item instanceof String) {
    item = await Redeem.findById(item).populate('createdBy', 'name');
  } else if (item && item._id) {
    const existing = await Redeem.findById(item._id).populate('createdBy', 'name');
    if (existing) item = existing;
  }

  if (!item) return false;

  let requesterName = 'Housemate';
  if (item.createdBy && item.createdBy.name) {
    requesterName = item.createdBy.name;
  } else if (item.createdBy) {
    const u = await User.findById(item.createdBy).select('name');
    if (u) requesterName = u.name;
  }

  const amountStr = Number(item.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const closedBy = closedByName || 'Ashwin';

  const text = `🎉 <b>Reimbursement Settled & Closed!</b>\n\n` +
    `👤 <b>Paid To</b>: <b>${requesterName}</b>\n` +
    `💰 <b>Amount Settled</b>: <b>₹${amountStr}</b>\n` +
    `✅ <b>Processed By</b>: <b>${closedBy}</b>\n\n` +
    `<i>The payout has been completed and marked closed on the portal! ✨</i>`;

  return sendTelegramMessage(text);
}

async function sendUnpaidRedeemReminder() {
  const Redeem = require('../models/Redeem');
  const openRedeems = await Redeem.find({ closed: false }).populate('createdBy', 'name');

  if (!openRedeems || openRedeems.length === 0) {
    return false;
  }

  const totalPendingAmount = openRedeems.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

  const itemsList = openRedeems
    .map((r) => {
      const name = r.createdBy?.name || 'Housemate';
      const noteStr = r.note ? ` <i>(${r.note})</i>` : '';
      return `• <b>${name}</b>: ₹${Number(r.amount || 0).toLocaleString('en-IN')}${noteStr}\n  UPI: <code>${r.upiId}</code>`;
    })
    .join('\n\n');

  const text = `🤝 <b>Pending Reimbursements Reminder</b>\n\n` +
    `Hi <b>Ashwin</b>! 👋\n` +
    `There ${openRedeems.length === 1 ? 'is <b>1 request</b>' : `are <b>${openRedeems.length} requests</b>`} awaiting settlement (Total: <b>₹${totalPendingAmount.toLocaleString('en-IN')}</b>):\n\n` +
    `${itemsList}\n\n` +
    `Please kindly settle via UPI when you get a moment and mark closed on the portal! Thank you so much! ✨`;

  return sendTelegramMessage(text);
}

async function sendNewExpenseNotification(expenseData) {
  try {
    const BankBalance = require('../models/BankBalance');
    const bankDoc = await BankBalance.findOne().sort({ updatedAt: -1 });

    const amountStr = Number(expenseData.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const category = expenseData.category || 'General';
    const desc = expenseData.description ? `\n📝 <b>Details</b>: ${expenseData.description}` : '';
    const paidBy = expenseData.paidByName || 'A housemate';
    const bankBalStr = bankDoc ? `\n🏦 <b>Bank Remaining Balance</b>: ₹${Number(bankDoc.balance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '';

    const text = `🧾 <b>New House Expense Recorded!</b>\n\n` +
      `💰 <b>Amount</b>: <b>₹${amountStr}</b>\n` +
      `🏷️ <b>Category</b>: <b>${category}</b>\n` +
      `👤 <b>Paid By</b>: <b>${paidBy}</b>${desc}${bankBalStr}\n\n` +
      `<i>Updated on the Sweet Home expense ledger. ✨</i>`;

    return sendTelegramMessage(text);
  } catch (err) {
    console.error('[telegram] Failed to send expense notification:', err.message);
    return false;
  }
}

async function sendContributionPaidNotification({ memberName, amount, monthLabel, paidCount, totalMembers }) {
  try {
    const amountStr = Number(amount || 0).toLocaleString('en-IN');
    const text = `🎉 <b>Monthly Contribution Received!</b>\n\n` +
      `👤 <b>Housemate</b>: <b>${memberName}</b>\n` +
      `💵 <b>Amount Paid</b>: <b>₹${amountStr}</b>\n` +
      `📅 <b>Month</b>: <b>${monthLabel || 'Current Month'}</b>\n` +
      `📊 <b>House Status</b>: <b>${paidCount || '?'}/${totalMembers || 9} Paid</b>\n\n` +
      `<i>Thank you for contributing on time! ✨</i>`;

    return sendTelegramMessage(text);
  } catch (err) {
    console.error('[telegram] Failed to send contribution notification:', err.message);
    return false;
  }
}

module.exports = {
  getTelegramConfig,
  updateTelegramConfig,
  sendTelegramMessage,
  sendTestMessage,
  sendTomorrowChoresNotification,
  sendRemainingMoneyNotification,
  sendNewRedeemNotification,
  sendRedeemClosedNotification,
  sendUnpaidRedeemReminder,
  sendNewExpenseNotification,
  sendContributionPaidNotification
};
