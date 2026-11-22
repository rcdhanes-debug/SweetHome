const ChoreSchedule = require('../models/ChoreSchedule');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const { DEFAULT_SCHEDULE, DAYS } = require('../utils/constants');
const { currentWeekday } = require('../utils/time');

function assertValidIds(ids) {
  if (!Array.isArray(ids)) throw new AppError('Invalid user list.', 400);
  for (const id of ids) {
    if (!String(id).match(/^[0-9a-fA-F]{24}$/)) throw new AppError('Invalid user identifier.', 400);
  }
}

function validateAssignment({ morningCooking, nightCooking, cleaning }, allUsers) {
  assertValidIds(morningCooking);
  assertValidIds(nightCooking);
  assertValidIds(cleaning);

  if (morningCooking.length !== 2) throw new AppError('Morning Cooking must have exactly 2 people.', 400);
  if (cleaning.length !== 2)       throw new AppError('Cleaning must have exactly 2 people.', 400);
  // nightCooking may be empty on weekends
  if (nightCooking.length !== 0 && nightCooking.length !== 2)
    throw new AppError('Night Cooking must have 0 or 2 people.', 400);

  if (String(morningCooking[0]) === String(morningCooking[1]))
    throw new AppError('Morning Cooking team must have 2 different people.', 400);
  if (String(cleaning[0]) === String(cleaning[1]))
    throw new AppError('Cleaning team must have 2 different people.', 400);
  if (nightCooking.length === 2 && String(nightCooking[0]) === String(nightCooking[1]))
    throw new AppError('Night Cooking team must have 2 different people.', 400);

  const assigned = [...morningCooking, ...nightCooking, ...cleaning].map(String);
  const known = new Set(allUsers.map((u) => String(u._id)));
  for (const id of assigned) {
    if (!known.has(id)) throw new AppError('Schedule references an unknown user.', 400);
  }
}

// Converts a stored ChoreSchedule document to plain JSON.
// No leave-of-absence substitution — what is stored is what is shown.
function dayToJSON(dayDoc, allUsers) {
  const userObj = (id) => {
    const u = allUsers.find((x) => String(x._id) === String(id));
    return u ? { _id: u._id, name: u.name } : null;
  };

  const active = new Set(
    [...dayDoc.morningCooking, ...dayDoc.nightCooking, ...dayDoc.cleaning].filter(Boolean).map(String)
  );

  return {
    _id: dayDoc._id,
    day: dayDoc.day,
    morningCooking: dayDoc.morningCooking.map(userObj).filter(Boolean),
    nightCooking:   dayDoc.nightCooking.map(userObj).filter(Boolean),
    cleaning:       dayDoc.cleaning.map(userObj).filter(Boolean),
    morningFood:    dayDoc.morningFood || '',
    nightFood:      dayDoc.nightFood || '',
    resting: allUsers
      .filter((u) => !active.has(String(u._id)))
      .map((u) => ({ _id: u._id, name: u.name })),
    updatedBy: dayDoc.updatedBy || null,
    updatedAt: dayDoc.updatedAt || null
  };
}

async function buildDefaultDocs() {
  const users = await User.find();
  if (users.length === 0) throw new AppError('No users exist yet. Please seed the database first.', 500);
  const byName = Object.fromEntries(users.map((u) => [u.name, u._id]));

  return DAYS.map((day) => {
    const s = DEFAULT_SCHEDULE[day];
    return {
      day,
      morningCooking: s.morningCooking.map((n) => byName[n]).filter(Boolean),
      nightCooking:   (s.nightCooking || []).map((n) => byName[n]).filter(Boolean),
      cleaning:       s.cleaning.map((n) => byName[n]).filter(Boolean),
      updatedBy: null
    };
  });
}

async function seedDefaultSchedule() {
  const docs = await buildDefaultDocs();
  const ops = docs.map((d) => ({
    updateOne: { filter: { day: d.day }, update: { $set: d }, upsert: true }
  }));
  await ChoreSchedule.bulkWrite(ops);
  return listAll();
}

async function listAll() {
  const allUsers = await User.find();
  const docs = await ChoreSchedule.find().sort({ day: 1 });
  const dayRank = Object.fromEntries(DAYS.map((d, i) => [d, i]));
  return docs
    .sort((a, b) => dayRank[a.day] - dayRank[b.day])
    .map((d) => dayToJSON(d, allUsers));
}

async function getToday() {
  const allUsers = await User.find();
  const day = currentWeekday();
  const doc = await ChoreSchedule.findOne({ day });
  if (!doc) throw new AppError('No schedule exists for today. Please seed the database.', 404);
  return { day, ...dayToJSON(doc, allUsers) };
}

async function getDay(day) {
  const allUsers = await User.find();
  const doc = await ChoreSchedule.findOne({ day });
  if (!doc) throw new AppError('Schedule not found.', 404);
  return dayToJSON(doc, allUsers);
}

async function updateDay({ day, morningCooking, nightCooking, cleaning, morningFood, nightFood, updatedBy }) {
  const allUsers = await User.find();
  const mc = Array.isArray(morningCooking) ? morningCooking : [];
  const nc = Array.isArray(nightCooking) ? nightCooking : [];
  const cl = Array.isArray(cleaning) ? cleaning : [];

  validateAssignment({ morningCooking: mc, nightCooking: nc, cleaning: cl }, allUsers);

  const doc = await ChoreSchedule.findOne({ day });
  if (!doc) throw new AppError('Schedule not found.', 404);

  const before = {
    morningCooking: (doc.morningCooking || []).map(String),
    nightCooking: (doc.nightCooking || []).map(String),
    cleaning: (doc.cleaning || []).map(String),
    morningFood: doc.morningFood || '',
    nightFood: doc.nightFood || ''
  };

  doc.morningCooking = mc;
  doc.nightCooking = nc;
  doc.cleaning = cl;
  if (morningFood !== undefined) doc.morningFood = String(morningFood).trim();
  if (nightFood !== undefined) doc.nightFood = String(nightFood).trim();
  doc.updatedBy = updatedBy;
  await doc.save();

  return { before, after: dayToJSON(doc, allUsers) };
}

async function swapUsers({ day, personA, personB, updatedBy }) {
  const allUsers = await User.find();
  const doc = await ChoreSchedule.findOne({ day });
  if (!doc) throw new AppError('Schedule not found.', 404);

  const aId = String(personA);
  const bId = String(personB);
  if (aId === bId) throw new AppError('Cannot swap a person with themselves.', 400);

  const known = new Set(allUsers.map((u) => String(u._id)));
  if (!known.has(aId) || !known.has(bId)) throw new AppError('Person does not exist.', 400);

  const roleOf = (id) => {
    if ((doc.morningCooking || []).some((x) => String(x) === id)) return 'morningCooking';
    if ((doc.nightCooking || []).some((x) => String(x) === id)) return 'nightCooking';
    if ((doc.cleaning || []).some((x) => String(x) === id)) return 'cleaning';
    return 'resting';
  };

  const aRole = roleOf(aId);
  const bRole = roleOf(bId);

  const before = {
    a: { id: aId, role: aRole },
    b: { id: bId, role: bRole }
  };

  const drop = (id) => id === aId || id === bId;
  doc.morningCooking = (doc.morningCooking || []).filter((x) => !drop(String(x)));
  doc.nightCooking = (doc.nightCooking || []).filter((x) => !drop(String(x)));
  doc.cleaning = (doc.cleaning || []).filter((x) => !drop(String(x)));

  const place = (role, id) => {
    if (role === 'morningCooking') doc.morningCooking.push(id);
    else if (role === 'nightCooking') doc.nightCooking.push(id);
    else if (role === 'cleaning') doc.cleaning.push(id);
  };

  place(bRole, aId);
  place(aRole, bId);

  validateAssignment({
    morningCooking: doc.morningCooking,
    nightCooking: doc.nightCooking,
    cleaning: doc.cleaning
  }, allUsers);

  doc.updatedBy = updatedBy;
  await doc.save();

  const nameOf = (id) => allUsers.find((u) => String(u._id) === id)?.name || id;
  return {
    before: { ...before, aName: nameOf(aId), bName: nameOf(bId) },
    after: dayToJSON(doc, allUsers)
  };
}

async function restoreDefault(updatedBy) {
  const docs = await buildDefaultDocs();
  for (const d of docs) {
    await ChoreSchedule.findOneAndUpdate({ day: d.day }, { $set: { ...d, updatedBy } }, { upsert: true });
  }
  return listAll();
}

module.exports = {
  seedDefaultSchedule,
  listAll,
  getToday,
  getDay,
  updateDay,
  swapUsers,
  restoreDefault,
  validateAssignment
};
