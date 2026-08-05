const router = require('express').Router();
const { auditLogs, getTelegramConfig, updateTelegramConfig, sendTelegramTest, sendTomorrowChoresTest, sendRemainingMoneyTest } = require('../controllers/adminController');
const { requireAuth, requireAdmin } = require('../middleware/auth');

router.get('/audit-logs', requireAuth, requireAdmin, auditLogs);
router.get('/telegram', requireAuth, requireAdmin, getTelegramConfig);
router.post('/telegram', requireAuth, requireAdmin, updateTelegramConfig);
router.post('/telegram/test', requireAuth, requireAdmin, sendTelegramTest);
router.post('/telegram/chores-test', requireAuth, requireAdmin, sendTomorrowChoresTest);
router.post('/telegram/balance-test', requireAuth, requireAdmin, sendRemainingMoneyTest);

module.exports = router;
