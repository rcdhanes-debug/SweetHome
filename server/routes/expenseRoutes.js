const router = require('express').Router();
const { list, currentMonth, create, update, remove } = require('../controllers/expenseController');
const { requireAuth, requireAdmin } = require('../middleware/auth');

router.get('/', list);
router.get('/current-month', currentMonth);
router.post('/', requireAuth, create);
router.patch('/:id', requireAuth, requireAdmin, update);
router.delete('/:id', requireAuth, requireAdmin, remove);

module.exports = router;
