const router = require('express').Router();
const { list, create, markRead, markAllRead, remove, removeAll } = require('../controllers/notificationController');
const { requireAuth } = require('../middleware/auth');

router.get('/', list);
router.post('/', requireAuth, create);
router.patch('/read-all', markAllRead);
router.delete('/all', removeAll);
router.patch('/:id/read', markRead);
router.delete('/:id', remove);

module.exports = router;
