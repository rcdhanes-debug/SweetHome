const notifications = require('../services/notificationService');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

const list = asyncHandler(async (req, res) => {
  res.json(await notifications.list());
});

const create = asyncHandler(async (req, res) => {
  const { type, title, message, month, refId } = req.body || {};
  if (!title || !String(title).trim()) throw new AppError('Title is required.', 400);
  const doc = await notifications.create({
    type,
    title: String(title).trim().slice(0, 120),
    message: String(message || '').trim().slice(0, 500),
    month: String(month || ''),
    refId: String(refId || ''),
    createdBy: req.user?._id || null
  });
  res.status(201).json(doc);
});

const markRead = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const doc = await notifications.markRead(id);
  if (!doc) throw new AppError('Notification not found.', 404);
  res.json(doc);
});

const markAllRead = asyncHandler(async (req, res) => {
  res.json(await notifications.markAllRead());
});

const remove = asyncHandler(async (req, res) => {
  const { id } = req.params;
  try {
    await notifications.dismiss(id);
  } catch (err) {
    throw new AppError(err.message, 404);
  }
  res.json({ ok: true });
});

const removeAll = asyncHandler(async (req, res) => {
  await notifications.removeAll();
  res.json({ ok: true, message: 'All notifications cleared.' });
});

module.exports = { list, create, markRead, markAllRead, remove, removeAll };
