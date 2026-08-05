const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { JWT_SECRET, TOKEN_TTL } = require('../config');

const verifyPin = asyncHandler(async (req, res) => {
  const { name, pin } = req.body || {};

  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new AppError('Please select your name.', 400);
  }
  if (!/^\d{4}$/.test(String(pin || ''))) {
    throw new AppError('PIN must be exactly 4 digits.', 400);
  }

  const user = await User.findOne({ name: name.trim() }).select('+pinHash');
  if (!user) {
    throw new AppError('Incorrect PIN.', 401);
  }

  const valid = await user.comparePin(pin);
  if (!valid) {
    throw new AppError('Incorrect PIN.', 401);
  }

  const token = jwt.sign(
    { userId: user._id.toString(), name: user.name, role: user.role },
    JWT_SECRET,
    { expiresIn: TOKEN_TTL }
  );

  res.json({
    token,
    expiresIn: TOKEN_TTL,
    user: { _id: user._id, name: user.name, role: user.role }
  });
});

module.exports = { verifyPin };
