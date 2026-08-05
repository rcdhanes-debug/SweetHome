const router = require('express').Router();
const { listUsers, changePin, updateUser, setAway, updateProfile } = require('../controllers/userController');
const { requireAuth, requireAdmin } = require('../middleware/auth');

router.get('/', listUsers);
router.patch('/:userId/away', requireAuth, setAway);
router.patch('/:userId/pin', requireAuth, requireAdmin, changePin);
router.patch('/:userId/profile', requireAuth, updateProfile);
router.patch('/:userId', requireAuth, requireAdmin, updateUser);

module.exports = router;
