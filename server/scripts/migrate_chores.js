const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('No MONGODB_URI found');
  await mongoose.connect(uri);
  console.log('Connected to DB');

  const User = require('../models/User');
  const ChoreSchedule = require('../models/ChoreSchedule');
  const { DEFAULT_SCHEDULE, DAYS } = require('../utils/constants');

  const users = await User.find();
  const byName = Object.fromEntries(users.map(u => [u.name, u._id]));

  for (const day of DAYS) {
    const s = DEFAULT_SCHEDULE[day];
    const morningCooking = s.morningCooking.map(n => byName[n]).filter(Boolean);
    const nightCooking = (s.nightCooking || []).map(n => byName[n]).filter(Boolean);
    const cleaning = s.cleaning.map(n => byName[n]).filter(Boolean);

    await ChoreSchedule.findOneAndUpdate(
      { day },
      { 
        $set: { day, morningCooking, nightCooking, cleaning },
        $unset: { cooking: '', homeClean: '' }
      },
      { upsert: true }
    );
    console.log('Updated schedule for', day);
  }

  const updatedDocs = await ChoreSchedule.find();
  console.log('Done! Current schedules count:', updatedDocs.length);
  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});

