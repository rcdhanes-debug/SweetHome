const Event = require('../models/Event');
const User = require('../models/User');
const audit = require('../services/auditService');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

const EVENT_TYPES = ['birthday', 'festival', 'outing', 'house', 'other'];

function parseRange(start, end) {
  const s = start && /^\d{4}-\d{2}-\d{2}$/.test(String(start)) ? new Date(`${String(start)}T00:00:00.000Z`) : null;
  const e = end && /^\d{4}-\d{2}-\d{2}$/.test(String(end)) ? new Date(`${String(end)}T23:59:59.999Z`) : null;
  return { s, e };
}

function serializeEvent(ev) {
  return {
    _id: ev._id,
    title: ev.title,
    type: ev.type,
    date: ev.date.toISOString().slice(0, 10),
    allDay: Boolean(ev.allDay),
    time: ev.time || '',
    location: ev.location || '',
    notes: ev.notes || '',
    userId: ev.userId || null,
    createdBy: ev.createdBy || null
  };
}

async function listEvents(start, end) {
  const { s, e } = parseRange(start, end);
  const events = await Event.find({
    ...(s ? { date: { $gte: s } } : {}),
    ...(e ? { date: { $lte: e } } : {})
  }).sort({ date: 1, createdAt: -1 });

  let birthdays = [];
  if (s && e) {
    const users = await User.find().select('name birthday').lean();
    birthdays = users
      .filter((u) => u.birthday && /^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/.test(u.birthday))
      .filter((u) => {
        const day = parseInt(u.birthday.slice(3, 5), 10);
        const month = parseInt(u.birthday.slice(0, 2), 10);
        const y = s.getUTCFullYear();
        const d = new Date(Date.UTC(y, month - 1, day));
        return d >= s && d <= e;
      })
      .map((u) => ({
        _id: `birthday-${String(u._id)}`,
        title: `${u.name}'s birthday`,
        type: 'birthday',
        date: `${s.getUTCFullYear()}-${u.birthday.slice(0, 5)}`,
        allDay: true,
        time: '',
        location: '',
        notes: '',
        userId: u._id,
        createdBy: null,
        auto: true
      }));
  }

  return [...birthdays, ...events.map(serializeEvent)].sort((a, b) =>
    a.date === b.date ? (a.auto ? -1 : 1) : a.date.localeCompare(b.date)
  );
}

const list = asyncHandler(async (req, res) => {
  res.json(await listEvents(req.query.start, req.query.end));
});

const create = asyncHandler(async (req, res) => {
  const { title, type, date, allDay, time, location, notes, userId } = req.body || {};
  if (!title || !String(title).trim()) throw new AppError('Title is required.', 400);
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(String(date))) throw new AppError('A valid date (YYYY-MM-DD) is required.', 400);
  if (type && !EVENT_TYPES.includes(type)) throw new AppError('Invalid event type.', 400);
  if (userId) {
    const u = await User.findById(userId);
    if (!u) throw new AppError('The linked member does not exist.', 400);
  }
  const cleanTime = String(time || '').trim().slice(0, 5);
  if (cleanTime && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(cleanTime)) throw new AppError('Time must be in HH:MM format.', 400);

  const event = await Event.create({
    title: String(title).trim().slice(0, 80),
    type: type || 'other',
    date: new Date(`${String(date)}T00:00:00.000Z`),
    allDay: allDay !== false,
    time: cleanTime,
    location: String(location || '').trim().slice(0, 120),
    notes: String(notes || '').trim().slice(0, 500),
    userId: userId || null,
    createdBy: req.user._id
  });

  await audit.log({
    action: 'EVENT_CREATED',
    performedBy: req.user._id,
    details: { title: event.title, type: event.type, date: String(date) }
  });

  res.status(201).json(serializeEvent(event));
});

const update = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const patch = req.body || {};

  const event = await Event.findById(id);
  if (!event) throw new AppError('Event not found.', 404);

  const canManage = req.user.role === 'admin' || String(event.createdBy) === String(req.user._id);
  if (!canManage) throw new AppError('Only an admin or the creator can edit this event.', 403);

  if (patch.title !== undefined) {
    if (!String(patch.title).trim()) throw new AppError('Title cannot be empty.', 400);
    event.title = String(patch.title).trim().slice(0, 80);
  }
  if (patch.type !== undefined) {
    if (!EVENT_TYPES.includes(patch.type)) throw new AppError('Invalid event type.', 400);
    event.type = patch.type;
  }
  if (patch.date !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(patch.date))) throw new AppError('A valid date (YYYY-MM-DD) is required.', 400);
    event.date = new Date(`${String(patch.date)}T00:00:00.000Z`);
  }
  if (patch.allDay !== undefined) event.allDay = Boolean(patch.allDay);
  if (patch.time !== undefined) {
    const cleanTime = String(patch.time).trim().slice(0, 5);
    if (cleanTime && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(cleanTime)) throw new AppError('Time must be in HH:MM format.', 400);
    event.time = cleanTime;
  }
  if (patch.location !== undefined) event.location = String(patch.location).trim().slice(0, 120);
  if (patch.notes !== undefined) event.notes = String(patch.notes).trim().slice(0, 500);
  if (patch.userId !== undefined) {
    if (patch.userId) {
      const u = await User.findById(patch.userId);
      if (!u) throw new AppError('The linked member does not exist.', 400);
    }
    event.userId = patch.userId || null;
  }

  await event.save();

  await audit.log({
    action: 'EVENT_EDITED',
    performedBy: req.user._id,
    details: { title: event.title, type: event.type, date: event.date.toISOString().slice(0, 10) }
  });

  res.json(serializeEvent(event));
});

const remove = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const event = await Event.findById(id);
  if (!event) throw new AppError('Event not found.', 404);

  const canManage = req.user.role === 'admin' || String(event.createdBy) === String(req.user._id);
  if (!canManage) throw new AppError('Only an admin or the creator can delete this event.', 403);

  await event.deleteOne();

  await audit.log({
    action: 'EVENT_DELETED',
    performedBy: req.user._id,
    details: { title: event.title, type: event.type, date: event.date.toISOString().slice(0, 10) }
  });

  res.json({ ok: true });
});

module.exports = { list, create, update, remove, listEvents, serializeEvent };
