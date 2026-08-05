const User = require('../models/User');
const bcrypt = require('bcryptjs');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { sortUsers, ADMINS } = require('../utils/constants');
const audit = require('../services/auditService');

const listUsers = asyncHandler(async (req, res) => {
  const users = await User.find().select('name role away avatar phone email birthday upiId').lean();
  res.json(
    sortUsers(users).map((u) => ({
      _id: u._id,
      name: u.name,
      role: u.role,
      away: Boolean(u.away),
      avatar: u.avatar || '',
      phone: u.phone || '',
      email: u.email || '',
      birthday: u.birthday || '',
      upiId: u.upiId || ''
    }))
  );
});

const updateProfile = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { avatar, phone, email, birthday, upiId } = req.body || {};

  const isSelf = String(userId) === String(req.user._id);
  const isAdmin = req.user.role === 'admin';
  if (!isSelf && !isAdmin) {
    throw new AppError('You can only update your own profile (or an admin can update any profile).', 403);
  }

  const target = await User.findById(userId);
  if (!target) throw new AppError('User not found.', 404);

  const changes = {};

  if (avatar !== undefined) {
    if (avatar === '') {
      changes.avatar = '';
    } else {
      if (typeof avatar !== 'string' || !/^data:image\/(jpeg|png|webp);base64,/.test(avatar)) {
        throw new AppError('Avatar must be a JPEG, PNG, or WebP image.', 400);
      }
      const buf = Buffer.from(avatar.slice(avatar.indexOf(',') + 1), 'base64');
      if (buf.length === 0) throw new AppError('Empty avatar image.', 400);
      if (buf.length > 300 * 1024) throw new AppError('Avatar is too large. Maximum size is 300 KB.', 400);
      changes.avatar = avatar;
    }
  }

  if (phone !== undefined) {
    const cleanPhone = String(phone).replace(/[^\d+ ]/g, '').trim().slice(0, 15);
    if (cleanPhone && !/^\+?\d[\d ]{6,14}$/.test(cleanPhone)) {
      throw new AppError('Phone number looks invalid.', 400);
    }
    changes.phone = cleanPhone;
  }

  if (email !== undefined) {
    const cleanEmail = String(email).trim().slice(0, 120);
    if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleanEmail)) {
      throw new AppError('Email address looks invalid.', 400);
    }
    changes.email = cleanEmail;
  }

  if (birthday !== undefined) {
    const cleanBirthday = String(birthday).trim();
    if (cleanBirthday && !/^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/.test(cleanBirthday)) {
      throw new AppError('Birthday must be in MM-DD format.', 400);
    }
    changes.birthday = cleanBirthday;
  }

  if (upiId !== undefined) {
    const cleanUpi = String(upiId).trim().slice(0, 120);
    if (cleanUpi && !/^[^\s@]+@[a-zA-Z]{2,}$/.test(cleanUpi)) {
      throw new AppError('UPI ID looks invalid (e.g. name@okbank).', 400);
    }
    changes.upiId = cleanUpi;
  }

  if (Object.keys(changes).length === 0) {
    throw new AppError('Nothing to update.', 400);
  }

  Object.assign(target, changes);
  await target.save();

  await audit.log({
    action: 'USER_PROFILE_UPDATED',
    performedBy: req.user._id,
    targetUser: target._id,
    details: { name: target.name, fields: Object.keys(changes) }
  });

  res.json({ _id: target._id, name: target.name, role: target.role, away: target.away, avatar: target.avatar, phone: target.phone, email: target.email, birthday: target.birthday, upiId: target.upiId });
});

const setAway = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { away } = req.body || {};

  const isSelf = String(userId) === String(req.user._id);
  const isAdmin = req.user.role === 'admin';
  if (!isSelf && !isAdmin) {
    throw new AppError('You can only change your own leave-of-absence status.', 403);
  }

  const target = await User.findById(userId);
  if (!target) throw new AppError('User not found.', 404);

  target.away = Boolean(away);
  await target.save();

  await audit.log({
    action: 'USER_AWAY_SET',
    performedBy: req.user._id,
    targetUser: target._id,
    details: { name: target.name, away: target.away }
  });

  res.json({ _id: target._id, name: target.name, role: target.role, away: target.away });
});

const changePin = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { newPin } = req.body || {};

  if (!/^\d{4}$/.test(String(newPin || ''))) {
    throw new AppError('PIN must be exactly 4 digits.', 400);
  }

  const target = await User.findById(userId);
  if (!target) throw new AppError('User not found.', 404);

  if (ADMINS.includes(target.name) && String(target._id) !== String(req.user._id)) {
    throw new AppError('Protected admin accounts cannot have their PIN changed by others.', 403);
  }

  const pinHash = await bcrypt.hash(String(newPin), 10);
  target.pinHash = pinHash;
  await target.save();

  await audit.log({
    action: 'PIN_CHANGED',
    performedBy: req.user._id,
    targetUser: target._id,
    details: { name: target.name }
  });

  res.json({ message: `PIN updated for ${target.name}.` });
});

const updateUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { role } = req.body || {};

  const target = await User.findById(userId);
  if (!target) throw new AppError('User not found.', 404);

  if (role !== undefined) {
    if (role !== 'member' && role !== 'admin') {
      throw new AppError('Role must be either "admin" or "member".', 400);
    }
    if (ADMINS.includes(target.name)) {
      throw new AppError('Protected admin accounts cannot have their role changed.', 403);
    }
    if (String(target._id) === String(req.user._id)) {
      throw new AppError('You cannot change your own role.', 403);
    }
    target.role = role;
    await target.save();
  }

  await audit.log({
    action: 'USER_UPDATED',
    performedBy: req.user._id,
    targetUser: target._id,
    details: { name: target.name, role: target.role }
  });

  res.json({ message: 'User updated.', user: { _id: target._id, name: target.name, role: target.role } });
});

module.exports = { listUsers, changePin, updateUser, setAway, updateProfile };
