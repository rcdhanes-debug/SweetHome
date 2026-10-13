const router = require('express').Router();
const {
  handleSmsWebhook,
  getWebhookInfo,
  simulateSms,
  getBalance,
  getTransactions,
  syncBalance,
  updateManualBalance
} = require('../controllers/bankController');
const { optionalAuth, requireAuth } = require('../middleware/auth');

// Public Webhook Endpoints for mobile SMS Forwarder app
// Accepts POST from SMS Forwarder apps
router.post('/sms-webhook', handleSmsWebhook);
router.post('/webhook', handleSmsWebhook);
router.post('/sms', handleSmsWebhook);

// Check webhook status / get setup instructions
router.get('/sms-webhook', getWebhookInfo);
router.get('/webhook-info', getWebhookInfo);

// Interactive test simulation (allows testing SMS text directly from UI)
router.post('/simulate-sms', optionalAuth, simulateSms);

// Stored bank balance & transaction feeds
router.get('/balance', optionalAuth, getBalance);
router.get('/transactions', optionalAuth, getTransactions);
router.post('/sync', optionalAuth, syncBalance);

// Manual balance adjustments
router.patch('/manual', requireAuth, updateManualBalance);

module.exports = router;
