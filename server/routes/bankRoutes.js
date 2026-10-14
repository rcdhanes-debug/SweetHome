const router = require('express').Router();
const {
  handleSmsWebhook,
  getWebhookInfo,
  simulateSms,
  getBalance,
  getTransactions,
  syncBalance,
  updateManualBalance,
  streamBankEvents
} = require('../controllers/bankController');
const { optionalAuth, requireAuth } = require('../middleware/auth');

// Real-time Event Stream (SSE) for instant browser updates when new SMS arrives
router.get('/events', streamBankEvents);

// Public Webhook Endpoints for mobile SMS Forwarder app
// Accepts POST from SMS Forwarder apps
router.post('/sms-webhook', handleSmsWebhook);
router.post('/webhook', handleSmsWebhook);
router.post('/sms', handleSmsWebhook);

// Check webhook status / get setup instructions or process GET webhook
const handleGetWebhook = (req, res, next) => {
  if (req.query.message || req.query.content || req.query.text || req.query.body || req.query.msg) {
    return handleSmsWebhook(req, res, next);
  }
  return getWebhookInfo(req, res, next);
};

router.get('/sms-webhook', handleGetWebhook);
router.get('/webhook', handleGetWebhook);
router.get('/sms', handleGetWebhook);
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
