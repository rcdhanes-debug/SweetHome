const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('No MONGODB_URI found');
  await mongoose.connect(uri);
  console.log('Connected to DB');

  const ChoreSchedule = require('../models/ChoreSchedule');
  const { DEFAULT_SCHEDULE, DAYS } = require('../utils/constants');

  for (const day of DAYS) {
    const s = DEFAULT_SCHEDULE[day];
    await ChoreSchedule.findOneAndUpdate(
      { day },
      { 
        $set: { 
          nightFood: s.nightFood || '',
          morningFood: s.morningFood || ''
        }
      }
    );
    console.log('Updated food details for', day);
  }

  console.log('Done updating food details!');
  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});

