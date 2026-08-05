const router = require('express').Router();
const asyncHandler = require('../utils/asyncHandler');
const pushService = require('../services/pushService');

// GET /api/push/vapid-public-key — returns VAPID public key for client subscription
router.get('/vapid-public-key', (req, res) => {
  res.json({ publicKey: pushService.VAPID_PUBLIC });
});

// POST /api/push/subscribe — save a device push subscription
router.post('/subscribe', asyncHandler(async (req, res) => {
  const { subscription } = req.body || {};
  if (!subscription || !subscription.endpoint || !subscription.keys) {
    return res.status(400).json({ error: 'Invalid subscription object.' });
  }
  const ua = req.headers['user-agent'] || '';
  await pushService.subscribe(subscription, ua);
  res.json({ ok: true });
}));

// POST /api/push/unsubscribe — remove a device push subscription
router.post('/unsubscribe', asyncHandler(async (req, res) => {
  const { endpoint } = req.body || {};
  if (!endpoint) return res.status(400).json({ error: 'Endpoint required.' });
  await pushService.unsubscribe(endpoint);
  res.json({ ok: true });
}));

// GET /api/push/subscribers — count of active push subscribers (admin info)
router.get('/subscribers', asyncHandler(async (req, res) => {
  const PushSubscription = require('../models/PushSubscription');
  const count = await PushSubscription.countDocuments();
  res.json({ count });
}));

// POST /api/push/send-test — manually send a test push to all devices (admin only)
router.post('/send-test', asyncHandler(async (req, res) => {
  const sent = await pushService.sendToAll(
    '🏠 Sweet Home — Test Push',
    'Push notifications are working correctly! 🎉',
    { url: '/' }
  );
  res.json({ ok: true, sent });
}));

// POST /api/push/send-cooking — manually trigger cooking push (admin)
router.post('/send-cooking', asyncHandler(async (req, res) => {
  await pushService.sendTomorrowCookingPush();
  res.json({ ok: true });
}));

// POST /api/push/send-balance — manually trigger balance push (admin)
router.post('/send-balance', asyncHandler(async (req, res) => {
  await pushService.sendRemainingBalancePush();
  res.json({ ok: true });
}));

// POST /api/push/send-contribution — manually trigger contribution status push (admin)
router.post('/send-contribution', asyncHandler(async (req, res) => {
  await pushService.sendContributionStatusPush();
  res.json({ ok: true });
}));

module.exports = router;

