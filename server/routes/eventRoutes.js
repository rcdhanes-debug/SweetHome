const router = require('express').Router();
const { list, create, update, remove } = require('../controllers/eventController');
const { requireAuth } = require('../middleware/auth');

router.get('/', list);
router.post('/', requireAuth, create);
router.patch('/:id', requireAuth, update);
router.delete('/:id', requireAuth, remove);

module.exports = router;
