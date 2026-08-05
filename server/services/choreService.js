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

function validateAssignment({ cooking, cleaning, homeClean }, allUsers) {
  assertValidIds(cooking);
  assertValidIds(cleaning);

  if (cooking.length !== 2) throw new AppError('Cooking must have exactly 2 people.', 400);
  if (cleaning.length !== 2) throw new AppError('Cleaning must have exactly 2 people.', 400);
  if (!homeClean) throw new AppError('Home Clean must have exactly 1 person.', 400);
  if (String(homeClean).length !== 24) throw new AppError('Home Clean must have exactly 1 person.', 400);

  const assigned = [...cooking, ...cleaning, homeClean].map(String);
  const unique = new Set(assigned);
  if (unique.size !== 5) {
    throw new AppError('A person cannot be assigned to multiple roles on the same day.', 400);
  }

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
    [...dayDoc.cooking, ...dayDoc.cleaning, dayDoc.homeClean].filter(Boolean).map(String)
  );

  return {
    _id: dayDoc._id,
    day: dayDoc.day,
    cooking: dayDoc.cooking.map(userObj).filter(Boolean),
    cleaning: dayDoc.cleaning.map(userObj).filter(Boolean),
    homeClean: dayDoc.homeClean ? userObj(dayDoc.homeClean) : null,
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
      cooking: s.cooking.map((n) => byName[n]).filter(Boolean),
      cleaning: s.cleaning.map((n) => byName[n]).filter(Boolean),
      homeClean: byName[s.homeClean] || null,
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

async function updateDay({ day, cooking, cleaning, homeClean, updatedBy }) {
  const allUsers = await User.find();
  validateAssignment({ cooking, cleaning, homeClean }, allUsers);

  const doc = await ChoreSchedule.findOne({ day });
  if (!doc) throw new AppError('Schedule not found.', 404);

  const before = {
    cooking: doc.cooking.map(String),
    cleaning: doc.cleaning.map(String),
    homeClean: doc.homeClean ? String(doc.homeClean) : null
  };

  doc.cooking = cooking;
  doc.cleaning = cleaning;
  doc.homeClean = homeClean;
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
    if (doc.cooking.some((x) => String(x) === id)) return 'cooking';
    if (doc.cleaning.some((x) => String(x) === id)) return 'cleaning';
    if (doc.homeClean && String(doc.homeClean) === id) return 'homeClean';
    return 'resting';
  };

  const aRole = roleOf(aId);
  const bRole = roleOf(bId);

  const before = {
    a: { id: aId, role: aRole },
    b: { id: bId, role: bRole }
  };

  const drop = (id) => id === aId || id === bId;
  doc.cooking = doc.cooking.filter((x) => !drop(String(x)));
  doc.cleaning = doc.cleaning.filter((x) => !drop(String(x)));
  if (doc.homeClean && drop(String(doc.homeClean))) {
    doc.homeClean = null;
  }

  const place = (role, id) => {
    if (role === 'cooking') doc.cooking.push(id);
    else if (role === 'cleaning') doc.cleaning.push(id);
    else if (role === 'homeClean') doc.homeClean = id;
  };

  place(bRole, aId);
  place(aRole, bId);

  validateAssignment({ cooking: doc.cooking, cleaning: doc.cleaning, homeClean: doc.homeClean }, allUsers);

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
