const router = require('express').Router();
const { list, today, updateDay, swap, restoreDefault } = require('../controllers/choreController');
const { requireAuth, requireAdmin } = require('../middleware/auth');

router.get('/', list);
router.get('/today', today);
router.patch('/:day', requireAuth, requireAdmin, updateDay);
router.post('/swap', requireAuth, requireAdmin, swap);
router.post('/restore-default', requireAuth, requireAdmin, restoreDefault);

module.exports = router;
