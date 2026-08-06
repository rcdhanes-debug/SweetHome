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

  const command = text.split(' ')[0].toLowerCase().replace('@sweet_home_updates_bot', '');
  const tz = TIMEZONE || 'Asia/Kolkata';

  if (command === '/getbalance' || command === '/balance') {
    const summary = await fundingService.getCurrentSummary();
    const pendingText = summary.partialCount > 0
      ? `⏳ <i>${summary.pendingCount} unpaid, ${summary.partialCount} partial payment(s)</i>`
      : (summary.pendingCount > 0 ? `⏳ <i>${summary.pendingCount} housemate(s) pending payment</i>` : `🎉 <i>All 9 housemates paid!</i>`);

    const reply = `💰 <b>Sweet Home Household Balance</b> (${summary.monthLabel})\n\n` +
      `✨ <b>Rollover</b>: ₹${(summary.rolloverBalance || 0).toLocaleString('en-IN')}\n` +
      `💵 <b>Total Collected</b>: ₹${summary.totalCollected.toLocaleString('en-IN')} (${summary.paidCount}/9 Fully Paid)\n` +
      `💸 <b>Total Spent</b>: ₹${summary.totalSpent.toLocaleString('en-IN')}\n\n` +
      `💳 <b>Available Balance</b>: <b>₹${summary.balance.toLocaleString('en-IN')}</b>\n\n` +
      pendingText;
    return replyTelegram(token, chatId, reply);
  }

  if (command === '/today' || command === '/chores' || command === '/schedule') {
    const todayDate = new Date();
    const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: tz }).format(todayDate);
    const dateStr = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: tz }).format(todayDate);

    const dayData = await choreService.getDay(weekday);
    const cooking = dayData?.cooking?.map((u) => u.name).join(', ') || 'None';
    const cleaning = dayData?.cleaning?.map((u) => u.name).join(', ') || 'None';
    const homeClean = dayData?.homeClean?.name || 'None';

    const reply = `☀️ <b>Today's Duty Schedule (${weekday}, ${dateStr})</b>\n\n` +
      `🍳 <b>Cooking</b>: ${cooking}\n` +
      `🧹 <b>Cleaning</b>: ${cleaning}\n` +
      `🏠 <b>Home Clean</b>: ${homeClean}\n\n` +
      `Keep it sparkling clean! ✨`;
    return replyTelegram(token, chatId, reply);
  }

  if (command === '/tomorrow') {
    const tomorrowDate = new Date(Date.now() + 86400000);
    const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: tz }).format(tomorrowDate);
    const dateStr = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: tz }).format(tomorrowDate);

    const dayData = await choreService.getDay(weekday);
    const cooking = dayData?.cooking?.map((u) => u.name).join(', ') || 'None';
    const cleaning = dayData?.cleaning?.map((u) => u.name).join(', ') || 'None';
    const homeClean = dayData?.homeClean?.name || 'None';

    const reply = `🌙 <b>Tomorrow's Duty Schedule (${weekday}, ${dateStr})</b>\n\n` +
      `🍳 <b>Cooking</b>: ${cooking}\n` +
      `🧹 <b>Cleaning</b>: ${cleaning}\n` +
      `🏠 <b>Home Clean</b>: ${homeClean}\n\n` +
      `Plan ahead! ✨`;
    return replyTelegram(token, chatId, reply);
  }

    const summary = await fundingService.getCurrentSummary();
    const pendingItems = summary.payments
      .filter((p) => p.status !== 'paid')
      .map((p) => {
        if (p.status === 'partial') {
          return `• <b>${p.user?.name || 'Member'}</b>: ₹${p.amount.toLocaleString('en-IN')} paid (<b>₹${(p.dueAmount || 0).toLocaleString('en-IN')} due</b>)`;
        }
        return `• <b>${p.user?.name || 'Member'}</b>: Unpaid (<b>₹${summary.contributionAmount.toLocaleString('en-IN')} due</b>)`;
      })
      .join('\n');

    const reply = `⏳ <b>Pending Monthly Contributions (${summary.monthLabel})</b>\n\n` +
      (pendingItems ? pendingItems + `\n\nTarget: ₹${summary.contributionAmount.toLocaleString('en-IN')} each` : `🎉 All housemates have paid for ${summary.monthLabel}!`);
    return replyTelegram(token, chatId, reply);

  if (command === '/redeem') {
    const Redeem = require('../models/Redeem');
    const openRedeems = await Redeem.find({ closed: false }).populate('createdBy', 'name');
    if (!openRedeems || openRedeems.length === 0) {
      return replyTelegram(token, chatId, `🎉 <b>No unpaid redeem requests!</b>\nAll redeem requests are currently settled and closed.`);
    }
    const itemsList = openRedeems
      .map((r) => `• <b>${r.createdBy?.name || 'Member'}</b>: ₹${r.amount.toLocaleString('en-IN')}${r.note ? ` (${r.note})` : ''} — <code>${r.upiId}</code>`)
      .join('\n');
    const reply = `🤝 <b>Unpaid Redeem Requests (${openRedeems.length})</b>\n\n${itemsList}\n\nHi <b>Ashwin</b>! 👋 Please kindly check when you get a moment! ✨`;
    return replyTelegram(token, chatId, reply);
  }

  if (command === '/help' || command === '/start') {
    const reply = `🏠 <b>Sweet Home Telegram Bot Commands</b>\n\n` +
      `💰 /getbalance - Check live remaining balance\n` +
      `🍳 /today - View today's duty schedule\n` +
      `🌙 /tomorrow - View tomorrow's duty schedule\n` +
      `⏳ /pending - See who is pending payment\n` +
      `🤝 /redeem - Check unpaid redeem requests\n` +
      `ℹ️ /help - Show this commands list`;
    return replyTelegram(token, chatId, reply);
  }
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
          pollingOffset = update.update_id + 1;
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
