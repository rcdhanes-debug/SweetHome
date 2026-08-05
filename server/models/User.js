const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    pinHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['admin', 'member'], default: 'member' },
    away: { type: Boolean, default: false },
    avatar: { type: String, default: '' },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
    birthday: { type: String, default: '' },
    upiId: { type: String, default: '', trim: true }
  },
  { timestamps: true }
);

userSchema.methods.comparePin = function comparePin(pin) {
  return bcrypt.compare(String(pin), this.pinHash);
};

module.exports = mongoose.model('User', userSchema);
