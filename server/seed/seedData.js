const bcrypt = require('bcryptjs');
const User = require('../models/User');
const FundingCycle = require('../models/FundingCycle');
const ChoreSchedule = require('../models/ChoreSchedule');
const connectDB = require('../config/db');
const { USER_ORDER, ADMINS, DEFAULT_SCHEDULE, DAYS, DEFAULT_UPI_IDS } = require('../utils/constants');
const { monthKey } = require('../utils/time');
const { createCycle } = require('../services/fundingService');

function parsePins() {
  const raw = process.env.SEED_PINS || '';
  const fallback = process.env.SEED_DEFAULT_PIN || '1234';
  const map = {};
  for (const entry of raw.split(',')) {
    const [name, pin] = entry.split('=').map((s) => s && s.trim());
    if (name && /^\d{4}$/.test(pin || '')) map[name] = pin;
  }
  return { map, fallback };
}

function pinFor(name, { map, fallback }) {
  return map[name] || fallback;
}

async function seedUsers({ force = false } = {}) {
  const { map, fallback } = parsePins();

  if (force) {
    await User.deleteMany({});
    console.log('Force mode: cleared existing users.');
  }

  const results = [];
  for (const name of USER_ORDER) {
    const role = ADMINS.includes(name) ? 'admin' : 'member';
    const pin = pinFor(name, { map, fallback });
    const pinHash = await bcrypt.hash(pin, 10);
    const defaultUpi = DEFAULT_UPI_IDS[name] || `${name.toLowerCase()}@okaxis`;

    const existing = await User.findOne({ name });
    if (existing) {
      let updated = false;
      if (existing.role !== role && !force) {
        existing.role = role;
        updated = true;
      }
      if (!existing.upiId) {
        existing.upiId = defaultUpi;
        updated = true;
      }
      if (updated) {
        await existing.save();
      }
      results.push({ name, role, status: 'exists', id: existing._id });
    } else {
      const created = await User.create({ name, role, pinHash, upiId: defaultUpi });
      results.push({ name, role, status: 'created', id: created._id });
    }
  }
  console.table(results.map((r) => ({ name: r.name, role: r.role, status: r.status })));
  return results;
}

async function seedFundingCycle() {
  const month = monthKey();
  let cycle = await FundingCycle.findOne({ month });
  if (cycle) {
    console.log(`Funding cycle for ${month} already exists. Skipping.`);
    return cycle;
  }
  cycle = await createCycle(month);
  console.log(`Seeded funding cycle for ${month} (9 pending payments).`);
  return cycle;
}

async function seedChoreSchedule() {
  const users = await User.find();
  if (users.length === 0) throw new Error('Users must be seeded before chore schedules.');
  const byName = Object.fromEntries(users.map((u) => [u.name, u._id]));

  const ops = DAYS.map((day) => {
    const s = DEFAULT_SCHEDULE[day];
    return {
      updateOne: {
        filter: { day },
        update: {
          $set: {
            day,
            cooking: s.cooking.map((n) => byName[n]).filter(Boolean),
            cleaning: s.cleaning.map((n) => byName[n]).filter(Boolean),
            homeClean: byName[s.homeClean] || null,
            updatedBy: null
          }
        },
        upsert: true
      }
    };
  });
  await ChoreSchedule.bulkWrite(ops);
  console.log(`Seeded default chore schedule for ${DAYS.length} days.`);
}

async function seedAll({ force = false } = {}) {
  const users = await seedUsers({ force });
  await seedFundingCycle();
  await seedChoreSchedule();
  return users;
}

async function runSeed({ force = false } = {}) {
  await connectDB();
  try {
    await seedAll({ force });
    console.log('Seed completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  }
}

module.exports = { seedAll, seedUsers, seedFundingCycle, seedChoreSchedule, runSeed };
