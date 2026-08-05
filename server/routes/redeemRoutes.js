const router = require('express').Router();
const { list, create, close, reopen, remove } = require('../controllers/redeemController');
const { requireAuth, requireAdmin } = require('../middleware/auth');

router.get('/', list);

router.post('/', create);
router.patch('/:id/close', close);
router.patch('/:id/reopen', requireAuth, requireAdmin, reopen);
router.delete('/:id', requireAuth, requireAdmin, remove);

module.exports = router;
