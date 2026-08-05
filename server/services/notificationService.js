const Notification = require('../models/Notification');

async function list(limit = 100) {
  return Notification.find().sort({ createdAt: -1 }).limit(limit).lean();
}

async function create({ type = 'GENERAL', title, message = '', month = '', refId = '', createdBy = null }) {
  if (!title) throw new Error('Notification title is required.');
  return Notification.create({ type, title, message, month, refId, createdBy });
}

async function markRead(id) {
  return Notification.findByIdAndUpdate(id, { read: true }, { new: true });
}

async function markAllRead() {
  await Notification.updateMany({ read: false }, { $set: { read: true } });
  return Notification.find().sort({ createdAt: -1 }).limit(100).lean();
}

async function dismiss(id) {
  const doc = await Notification.findByIdAndDelete(id);
  if (!doc) throw new Error('Notification not found.');
  return doc;
}

async function removeAll() {
  await Notification.deleteMany({});
  return [];
}

async function upsertContributionDue(month, pendingNames) {
  const existing = await Notification.findOne({ type: 'CONTRIBUTION_DUE', month });
  const message = `Payment deadline for ${month} has passed. Pending: ${pendingNames.join(', ')}.`;
  if (existing) {
    existing.message = message;
    existing.read = false;
    await existing.save();
    return existing;
  }
  return Notification.create({
    type: 'CONTRIBUTION_DUE',
    title: 'Contribution due',
    message,
    month
  });
}

async function resolveContributionDue(month) {
  return Notification.deleteMany({ type: 'CONTRIBUTION_DUE', month });
}

async function ensureEventReminders(events) {
  const created = [];
  for (const ev of events) {
    const refId = `${String(ev._id)}-${ev.date}`;
    const exists = await Notification.findOne({ type: 'EVENT_REMINDER', refId });
    if (exists) continue;
    created.push(
      await Notification.create({
        type: 'EVENT_REMINDER',
        title: `Upcoming: ${ev.title}`,
        message: `Tomorrow (${ev.date}) — ${ev.type}${ev.time ? ` at ${ev.time}` : ''}.`,
        refId,
        createdBy: null
      })
    );
  }
  return created;
}

module.exports = {
  list,
  create,
  markRead,
  markAllRead,
  dismiss,
  removeAll,
  upsertContributionDue,
  resolveContributionDue,
  ensureEventReminders
};
