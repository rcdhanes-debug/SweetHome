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

  // Tomorrow weekday & date label
  const tomorrowDate = new Date(Date.now() + 86400000);
  const tomorrowWeekday = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: tz }).format(tomorrowDate);
  const tomorrowDateStr = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: tz }).format(tomorrowDate);

  const dayData = await choreService.getDay(tomorrowWeekday);
  if (!dayData) return false;

  const cooking = dayData.cooking?.map((u) => u.name).join(', ') || 'None';
  const cleaning = dayData.cleaning?.map((u) => u.name).join(', ') || 'None';
  const homeClean = dayData.homeClean?.name || 'None';

  const text = `🌙 <b>Tomorrow's Duty Schedule (${tomorrowWeekday}, ${tomorrowDateStr})</b>\n\n` +
    `🍳 <b>Cooking</b>: ${cooking}\n` +
    `🧹 <b>Cleaning</b>: ${cleaning}\n` +
    `🏠 <b>Home Clean</b>: ${homeClean}\n\n` +
    `Have a great evening! ✨`;

  return sendTelegramMessage(text);
}

async function sendRemainingMoneyNotification() {
  const fundingService = require('./fundingService');
  const summary = await fundingService.getCurrentSummary();

  const pendingText = summary.partialCount > 0
    ? `⏳ <i>${summary.pendingCount} unpaid, ${summary.partialCount} partial payment(s)</i>`
    : (summary.pendingCount > 0 ? `⏳ <i>${summary.pendingCount} housemate(s) pending payment</i>` : `🎉 <i>All 9 housemates paid!</i>`);

  const text = `💰 <b>Remaining Household Balance Update</b> (${summary.monthLabel})\n\n` +
    `✨ <b>Carried Over Rollover</b>: ₹${summary.rolloverBalance.toLocaleString('en-IN')}\n` +
    `💵 <b>Total Collected</b>: ₹${summary.totalCollected.toLocaleString('en-IN')} (${summary.paidCount}/9 Fully Paid)\n` +
    `💸 <b>Total Spent</b>: ₹${summary.totalSpent.toLocaleString('en-IN')}\n\n` +
    `💳 <b>Available Remaining Money</b>: <b>₹${summary.balance.toLocaleString('en-IN')}</b>\n\n` +
    pendingText;

  return sendTelegramMessage(text);
}

async function sendUnpaidRedeemReminder() {
  const Redeem = require('../models/Redeem');
  const openRedeems = await Redeem.find({ closed: false }).populate('createdBy', 'name');

  if (!openRedeems || openRedeems.length === 0) {
    return false;
  }

  const itemsList = openRedeems
    .map((r) => {
      const name = r.createdBy?.name || 'Housemate';
      const noteStr = r.note ? ` (${r.note})` : '';
      return `• <b>${name}</b>: ₹${r.amount.toLocaleString('en-IN')}${noteStr} — <code>${r.upiId}</code>`;
    })
    .join('\n');

  const text = `🤝 <b>Unpaid Redeem Requests Reminder</b>\n\n` +
    `Hi <b>Ashwin</b>! 👋\n` +
    `There ${openRedeems.length === 1 ? 'is 1 unpaid redeem request' : `are ${openRedeems.length} unpaid redeem requests`} pending settlement:\n\n` +
    `${itemsList}\n\n` +
    `Please kindly check when you get a moment, settle the payment(s) via UPI, and mark them closed on the portal! Thank you so much! ✨`;

  return sendTelegramMessage(text);
}

module.exports = {
  getTelegramConfig,
  updateTelegramConfig,
  sendTelegramMessage,
  sendTestMessage,
  sendTomorrowChoresNotification,
  sendRemainingMoneyNotification,
  sendUnpaidRedeemReminder
};
