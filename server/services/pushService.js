const webpush = require('web-push');
const PushSubscription = require('../models/PushSubscription');

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY || 'BAd-OcTnB2lx8JQh3KWClUllMzcT79hr9rDk1_W2XSdk6vQkOftgQg6MAsfrpaj_iDm_tJMBKKw16JHJMQr5eCA';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || 'iZ8AN0fxcPs8GBlOA1veJhQlWUq-l9jO70j_BD0eYn8';
const VAPID_EMAIL = process.env.VAPID_EMAIL || 'mailto:sweethome@example.com';

webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);

async function subscribe(subscriptionData, userAgent) {
  const { endpoint, keys } = subscriptionData;
  await PushSubscription.findOneAndUpdate(
    { endpoint },
    { endpoint, keys, userAgent: userAgent || '' },
    { upsert: true, new: true }
  );
}

async function unsubscribe(endpoint) {
  await PushSubscription.deleteOne({ endpoint });
}

async function sendToAll(title, body, data = {}) {
  const subs = await PushSubscription.find();
  if (!subs.length) return;

  const payload = JSON.stringify({ title, body, data });
  const results = await Promise.allSettled(
    subs.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: sub.keys },
        payload,
        { TTL: 86400 }
      ).catch(async (err) => {
        // Remove expired/invalid subscriptions (410 Gone)
        if (err.statusCode === 410 || err.statusCode === 404) {
          await PushSubscription.deleteOne({ endpoint: sub.endpoint });
        }
        throw err;
      })
    )
  );

  const sent = results.filter((r) => r.status === 'fulfilled').length;
  console.log(`[push] Sent ${sent}/${subs.length} push notifications: "${title}"`);
  return sent;
}

// --- Specific push notification functions ---

async function sendTomorrowCookingPush() {
  const chores = require('../services/choreService');
  const { DAYS } = require('../utils/constants');
  const { currentWeekday } = require('../utils/time');

  const today = currentWeekday();
  const todayIdx = DAYS.indexOf(today);
  const tomorrowDay = DAYS[(todayIdx + 1) % DAYS.length];

  let schedule;
  try {
    schedule = await chores.getDay(tomorrowDay);
  } catch {
    return;
  }

  const cooks = schedule.cooking.map((u) => u.name).join(' & ');
  if (!cooks) return;

  return sendToAll(
    `🍳 Tomorrow's Cooking Duty`,
    `${cooks} — please prepare for ${tomorrowDay}'s cooking! 🔥`,
    { url: '/chores' }
  );
}

async function sendContributionStatusPush() {
  const fundingService = require('../services/fundingService');
  const summary = await fundingService.getCurrentSummary();

  const paid = summary.payments.filter((p) => p.status === 'paid').map((p) => p.user?.name).filter(Boolean);
  const partial = summary.payments.filter((p) => p.status === 'partial').map((p) => `${p.user?.name} (₹${p.dueAmount} due)`).filter(Boolean);
  const pending = summary.payments.filter((p) => p.status === 'pending').map((p) => p.user?.name).filter(Boolean);

  let body = '';
  if (pending.length === 0 && partial.length === 0) {
    body = `🎉 All ${paid.length} housemates have paid for ${summary.monthLabel}!`;
  } else {
    const parts = [`✅ ${paid.length} paid`];
    if (partial.length > 0) parts.push(`⚡ ${partial.length} partial: ${partial.join(', ')}`);
    if (pending.length > 0) parts.push(`⏳ ${pending.length} pending: ${pending.join(', ')}`);
    body = parts.join(' • ');
  }

  return sendToAll(
    `💰 Monthly Contribution Status — ${summary.monthLabel}`,
    body,
    { url: '/collection' }
  );
}

async function sendRemainingBalancePush() {
  const fundingService = require('../services/fundingService');
  const summary = await fundingService.getCurrentSummary();

  const body = `Available: ₹${summary.balance.toLocaleString('en-IN')} • Spent: ₹${summary.totalSpent.toLocaleString('en-IN')} • Collected: ₹${summary.totalCollected.toLocaleString('en-IN')}`;

  return sendToAll(
    `🏠 Sweet Home Balance — ${summary.monthLabel}`,
    body,
    { url: '/' }
  );
}

module.exports = {
  VAPID_PUBLIC,
  subscribe,
  unsubscribe,
  sendToAll,
  sendTomorrowCookingPush,
  sendContributionStatusPush,
  sendRemainingBalancePush
};
