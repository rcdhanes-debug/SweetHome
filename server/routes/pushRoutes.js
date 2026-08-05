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

module.exports = router;
