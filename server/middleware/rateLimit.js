const rateLimit = require('express-rate-limit');

const pinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many PIN attempts. Please try again in 15 minutes.' }
});

module.exports = { pinLimiter };
