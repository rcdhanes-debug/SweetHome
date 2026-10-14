const { getTelegramConfig } = require('./telegramService');
const fundingService = require('./fundingService');
const choreService = require('./choreService');
const { TIMEZONE } = require('../config');

let pollingOffset = 0;
let isPolling = false;

async function replyTelegram(token, chatId, text) {
  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML'
      })
    });
  } catch (err) {
    console.error('[telegram-bot] Reply error:', err.message);
  }
}

async function handleCommand(msg, token) {
  const text = (msg.text || '').trim();
  const chatId = msg.chat?.id;
  if (!text || !chatId) return;

  const firstWord = text.split(' ')[0].toLowerCase();
  const command = firstWord.split('@')[0];
  const tz = TIMEZONE || 'Asia/Kolkata';

  if (command === '/getbalance' || command === '/balance') {
    const BankBalance = require('../models/BankBalance');
    const summary = await fundingService.getCurrentSummary();
    const bankDoc = await BankBalance.findOne().sort({ updatedAt: -1 });

    const bankAmount = bankDoc ? bankDoc.balance : summary.balance;
    const bankDetails = bankDoc?.accountLast4 ? ` <i>(${bankDoc.bankName || 'IDFC FIRST Bank'} • XX${bankDoc.accountLast4})</i>` : '';

    const pendingText = summary.partialCount > 0
      ? `⏳ <i>${summary.pendingCount} unpaid, ${summary.partialCount} partial payment(s)</i>`
      : (summary.pendingCount > 0 ? `⏳ <i>${summary.pendingCount} housemate(s) pending payment</i>` : `🎉 <i>All 9 housemates paid!</i>`);

    const reply = `💰 <b>Sweet Home Household Balance</b> (${summary.monthLabel})\n\n` +
      `💵 <b>Total Collected</b>: ₹${summary.totalCollected.toLocaleString('en-IN')} (${summary.paidCount}/9 Fully Paid)\n` +
      `💸 <b>Total Spent</b>: ₹${summary.totalSpent.toLocaleString('en-IN')}\n\n` +
      `🏦 <b>Bank Remaining Balance</b>: <b>₹${Number(bankAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b>${bankDetails}\n\n` +
      pendingText;
    return replyTelegram(token, chatId, reply);
  }

  if (command === '/today' || command === '/chores' || command === '/schedule') {
    const todayDate = new Date();
    const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: tz }).format(todayDate);
    const dateStr = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: tz }).format(todayDate);

    const dayData = await choreService.getDay(weekday);
    const cooking = dayData?.cooking?.map((u) => u.name).join(' & ') || 'None';
    const cleaning = dayData?.cleaning?.map((u) => u.name).join(', ') || 'None';
    const homeClean = dayData?.homeClean?.name || 'None';

    const reply = `☀️ <b>Today's Duty Schedule</b>\n` +
      `📅 <b>${weekday}, ${dateStr}</b>\n\n` +
      `🍳 <b>Cooking Team</b>: <b>${cooking}</b>\n` +
      `🧹 <b>Kitchen & Utensils</b>: <b>${cleaning}</b>\n` +
      `🏠 <b>Hall & Common Area</b>: <b>${homeClean}</b>\n\n` +
      `<i>Let's have a wonderful and productive day together! ✨</i>`;
    return replyTelegram(token, chatId, reply);
  }

  if (command === '/tomorrow') {
    const tomorrowDate = new Date(Date.now() + 86400000);
    const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: tz }).format(tomorrowDate);
    const dateStr = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: tz }).format(tomorrowDate);

    const dayData = await choreService.getDay(weekday);
    const cooking = dayData?.cooking?.map((u) => u.name).join(' & ') || 'None';
    const cleaning = dayData?.cleaning?.map((u) => u.name).join(', ') || 'None';
    const homeClean = dayData?.homeClean?.name || 'None';

    const reply = `🌙 <b>Tomorrow's Duty Schedule</b>\n` +
      `📅 <b>${weekday}, ${dateStr}</b>\n\n` +
      `🍳 <b>Cooking Team</b>: <b>${cooking}</b>\n` +
      `🧹 <b>Kitchen & Utensils</b>: <b>${cleaning}</b>\n` +
      `🏠 <b>Hall & Common Area</b>: <b>${homeClean}</b>\n\n` +
      `<i>Plan ingredients & prep tonight! Have a restful evening! ✨</i>`;
    return replyTelegram(token, chatId, reply);
  }

  if (command === '/pending' || command === '/unpaid' || command === '/dues') {
    const summary = await fundingService.getCurrentSummary();
    const unpaidPayments = summary.payments.filter((p) => p.status !== 'paid');

    let totalDue = 0;
    const pendingItems = unpaidPayments.map((p) => {
      const due = p.status === 'partial' ? (p.dueAmount || 0) : summary.contributionAmount;
      totalDue += due;
      if (p.status === 'partial') {
        return `• <b>${p.user?.name || 'Member'}</b>: ₹${p.amount.toLocaleString('en-IN')} paid (<b>₹${due.toLocaleString('en-IN')} remaining</b>)`;
      }
      return `• <b>${p.user?.name || 'Member'}</b>: Unpaid (<b>₹${due.toLocaleString('en-IN')} due</b>)`;
    }).join('\n');

    const reply = `⏳ <b>Pending Monthly Contributions</b>\n` +
      `📅 <b>Month</b>: ${summary.monthLabel}\n\n` +
      (unpaidPayments.length > 0
        ? `${pendingItems}\n\n` +
          `💰 <b>Total Pending Collection</b>: <b>₹${totalDue.toLocaleString('en-IN')}</b>\n` +
          `🎯 <b>Target Each</b>: ₹${summary.contributionAmount.toLocaleString('en-IN')}`
        : `🎉 <b>All 9 housemates have paid for ${summary.monthLabel}! Super proud of everyone!</b> ✨`);
    return replyTelegram(token, chatId, reply);
  }

  if (command === '/redeem') {
    const Redeem = require('../models/Redeem');
    const openRedeems = await Redeem.find({ closed: false }).populate('createdBy', 'name');
    if (!openRedeems || openRedeems.length === 0) {
      return replyTelegram(token, chatId, `🎉 <b>No unpaid redeem requests!</b>\nAll reimbursement requests are settled and closed. ✨`);
    }
    const totalSum = openRedeems.reduce((acc, r) => acc + (Number(r.amount) || 0), 0);
    const itemsList = openRedeems
      .map((r) => `• <b>${r.createdBy?.name || 'Member'}</b>: ₹${Number(r.amount || 0).toLocaleString('en-IN')}${r.note ? ` <i>(${r.note})</i>` : ''}\n  UPI: <code>${r.upiId}</code>`)
      .join('\n\n');
    const reply = `🤝 <b>Pending Reimbursements (${openRedeems.length})</b>\n\n` +
      `${itemsList}\n\n` +
      `💰 <b>Total Pending Payout</b>: <b>₹${totalSum.toLocaleString('en-IN')}</b>\n\n` +
      `Hi <b>Ashwin</b>! 👋 Please kindly check when you get a moment! ✨`;
    return replyTelegram(token, chatId, reply);
  }

  if (command === '/help' || command === '/start') {
    const reply = `🏠 <b>Sweet Home Telegram Bot Guide</b>\n\n` +
      `💰 <b>Financial Commands</b>\n` +
      `• /getbalance — Check live IDFC bank balance & collection status\n` +
      `• /pending — View who is pending payment & total dues\n` +
      `• /redeem — View unpaid reimbursement requests\n\n` +
      `🍳 <b>Duty & Chores Commands</b>\n` +
      `• /today — View today's cooking & cleaning crew\n` +
      `• /tomorrow — View tomorrow's duty schedule\n\n` +
      `ℹ️ /help — Show this command directory\n\n` +
      `<i>Sweet Home • Living Together Made Seamless ❤️</i>`;
    return replyTelegram(token, chatId, reply);
  }
}

const processedUpdateIds = new Set();

function isRecentlyProcessed(updateId) {
  if (!updateId) return false;
  if (processedUpdateIds.has(updateId)) return true;
  processedUpdateIds.add(updateId);
  if (processedUpdateIds.size > 500) {
    const firstKey = processedUpdateIds.values().next().value;
    processedUpdateIds.delete(firstKey);
  }
  return false;
}

async function startBotPolling() {
  if (isPolling) return;
  isPolling = true;
  console.log('[telegram-bot] Interactive Bot Commands Polling initialized.');

  while (isPolling) {
    try {
      const { token, enabled } = await getTelegramConfig();
      if (!enabled || !token) {
        await new Promise((r) => setTimeout(r, 10000));
        continue;
      }

      const url = `https://api.telegram.org/bot${token}/getUpdates?offset=${pollingOffset}&timeout=25`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.ok && Array.isArray(data.result)) {
        for (const update of data.result) {
          pollingOffset = Math.max(pollingOffset, update.update_id + 1);
          if (isRecentlyProcessed(update.update_id)) continue;

          if (update.message && update.message.text) {
            handleCommand(update.message, token).catch((err) => {
              console.error('[telegram-bot] Command execution error:', err.message);
            });
          }
        }
      }
    } catch (_) {
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

module.exports = { startBotPolling };
