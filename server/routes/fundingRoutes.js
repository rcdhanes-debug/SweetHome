const router = require('express').Router();
const { getCurrent, getHistory, getReport, markPaid, setStatus, resetMonth, setContributionAmount, setRolloverAmount, updateCommonAccount } = require('../controllers/fundingController');
const { requireAuth, requireAdmin } = require('../middleware/auth');

router.get('/current', getCurrent);
router.get('/history', getHistory);
router.get('/report', getReport);

router.post('/settings', requireAuth, requireAdmin, setContributionAmount);
router.post('/rollover', requireAuth, requireAdmin, setRolloverAmount);
router.patch('/common-account', requireAuth, requireAdmin, updateCommonAccount);
router.post('/:userId/pay', requireAuth, requireAdmin, markPaid);
router.patch('/:userId/status', requireAuth, requireAdmin, setStatus);
router.post('/reset', requireAuth, requireAdmin, resetMonth);

module.exports = router;

