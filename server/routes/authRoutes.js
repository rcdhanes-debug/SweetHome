const router = require('express').Router();
const { verifyPin } = require('../controllers/authController');
const { pinLimiter } = require('../middleware/rateLimit');

router.post('/verify-pin', pinLimiter, verifyPin);

module.exports = router;
