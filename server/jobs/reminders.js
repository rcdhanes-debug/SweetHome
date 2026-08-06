const cron = require('node-cron');
const funding = require('../services/fundingService');
const notifications = require('../services/notificationService');
const Event = require('../models/Event');
const { HOUSEHOLD_TZ, istParts } = require('../utils/time');
const { PAYMENT_DEADLINE_DAY } = require('../utils/constants');

const DAY_MS = 86400000;

async function tomorrowEvents() {
  const p = istParts(new Date());
  const todayUtc = new Date(Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day)));
  const start = new Date(todayUtc.getTime() + DAY_MS);
  const end = new Date(start.getTime() + DAY_MS);
  return Event.find({ date: { $gte: start, $lt: end } });
}

async function runReminderChecks() {
  const p = istParts(new Date());
  const todayDay = Number(p.day);

  // 1. Contribution due after the monthly deadline.
  if (todayDay >= PAYMENT_DEADLINE_DAY) {
    const month = `${p.year}-${p.month}`;
    const summary = await funding.getCurrentSummary();
    const pendingNames = summary.payments
      .filter((pay) => pay.status !== 'paid')
      .map((pay) => pay.status === 'partial' ? `${pay.user?.name} (₹${pay.dueAmount} due)` : `${pay.user?.name} (Unpaid)`);
    if (pendingNames.length > 0) {
      await notifications.upsertContributionDue(month, pendingNames);
    } else {
      await notifications.resolveContributionDue(month);
    }
  }

  // 2. Remind about tomorrow's events.
  const upcoming = await tomorrowEvents();
  if (upcoming.length > 0) {
    await notifications.ensureEventReminders(
      upcoming.map((ev) => ({ _id: ev._id, title: ev.title, type: ev.type, date: ev.date.toISOString().slice(0, 10), time: ev.time }))
    );
  }
}

// Run twice a day so reminders appear morning and evening.
function startReminderJobs() {
  const job = cron.schedule(
    '0 8,20 * * *',
    async () => {
      console.log('[cron] Reminder checks triggered.');
      try {
        await runReminderChecks();
      } catch (err) {
        console.error('[cron] Reminder check failed:', err.message);
      }
    },
    { timezone: HOUSEHOLD_TZ }
  );
  console.log(`[cron] Reminder checks scheduled: daily 08:00 & 20:00 (${HOUSEHOLD_TZ}).`);

  // Daily 9:00 PM (21:00 IST) Telegram alert for Tomorrow's Chores schedule
  cron.schedule(
    '0 21 * * *',
    async () => {
      console.log('[cron] 9:00 PM Tomorrow Chores Telegram alert triggered.');
      try {
        const telegram = require('../services/telegramService');
        await telegram.sendTomorrowChoresNotification();
      } catch (err) {
        console.error('[cron] Tomorrow Chores Telegram alert failed:', err.message);
      }
    },
    { timezone: HOUSEHOLD_TZ }
  );
  console.log(`[cron] Telegram 9:00 PM Tomorrow's Chores scheduled: daily 21:00 (${HOUSEHOLD_TZ}).`);

  // Daily 8:00 PM (20:00 IST) Telegram alert for Unpaid Redeem Requests (messaging Ashwin politely)
  cron.schedule(
    '0 20 * * *',
    async () => {
      console.log('[cron] 8:00 PM Unpaid Redeem Telegram alert triggered.');
      try {
        const telegram = require('../services/telegramService');
        await telegram.sendUnpaidRedeemReminder();
      } catch (err) {
        console.error('[cron] Unpaid Redeem Telegram alert failed:', err.message);
      }
    },
    { timezone: HOUSEHOLD_TZ }
  );
  console.log(`[cron] Telegram 8:00 PM Unpaid Redeem alert scheduled: daily 20:00 (${HOUSEHOLD_TZ}).`);

  // Every 2 days at 10:00 AM IST Telegram alert for Remaining Money / Available Balance
  cron.schedule(
    '0 10 */2 * *',
    async () => {
      console.log('[cron] 2-day Remaining Money Telegram alert triggered.');
      try {
        const telegram = require('../services/telegramService');
        await telegram.sendRemainingMoneyNotification();
      } catch (err) {
        console.error('[cron] Remaining Money Telegram alert failed:', err.message);
      }
    },
    { timezone: HOUSEHOLD_TZ }
  );
  console.log(`[cron] Telegram 2-day Remaining Money update scheduled: 10:00 AM every 2 days (${HOUSEHOLD_TZ}).`);

  // --- Web Push Notifications ---

  // Daily 8:00 PM (20:00 IST) — Push: Tomorrow's Cooking Duty
  cron.schedule(
    '0 20 * * *',
    async () => {
      console.log('[cron] 8:00 PM Tomorrow Cooking push triggered.');
      try {
        const push = require('../services/pushService');
        await push.sendTomorrowCookingPush();
      } catch (err) {
        console.error('[cron] Tomorrow Cooking push failed:', err.message);
      }
    },
    { timezone: HOUSEHOLD_TZ }
  );
  console.log(`[cron] Push 8:00 PM Tomorrow Cooking scheduled: daily 20:00 (${HOUSEHOLD_TZ}).`);

  // 5th of every month at 9:00 AM — Push: Monthly Contribution Status
  cron.schedule(
    '0 9 5 * *',
    async () => {
      console.log('[cron] 5th-of-month Contribution Status push triggered.');
      try {
        const push = require('../services/pushService');
        await push.sendContributionStatusPush();
      } catch (err) {
        console.error('[cron] Contribution Status push failed:', err.message);
      }
    },
    { timezone: HOUSEHOLD_TZ }
  );
  console.log(`[cron] Push 5th-of-month Contribution Status scheduled: 09:00 on 5th (${HOUSEHOLD_TZ}).`);

  // Every 2 days at 10:00 AM — Push: Remaining Balance
  cron.schedule(
    '0 10 */2 * *',
    async () => {
      console.log('[cron] 2-day Remaining Balance push triggered.');
      try {
        const push = require('../services/pushService');
        await push.sendRemainingBalancePush();
      } catch (err) {
        console.error('[cron] Remaining Balance push failed:', err.message);
      }
    },
    { timezone: HOUSEHOLD_TZ }
  );
  console.log(`[cron] Push 2-day Remaining Balance scheduled: 10:00 AM every 2 days (${HOUSEHOLD_TZ}).`);

  return job;
}

module.exports = { startReminderJobs, runReminderChecks };
