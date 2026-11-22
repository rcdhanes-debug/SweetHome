const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const ChoreSchedule = require('../models/ChoreSchedule');
  const User = require('../models/User');
  const users = await User.find();
  const byName = Object.fromEntries(users.map(u => [u.name, u._id]));

  // Saturday: Gowtham, Bala (or Ashwin) | Cleaning: Akash, Veera
  // Sunday: Robert, Akash | Cleaning: Bhuvi🦁, Dhanesh
  await ChoreSchedule.findOneAndUpdate(
    { day: 'Saturday' },
    {
      $set: {
        morningCooking: [byName['Gowtham'], byName['Bala']],
        nightCooking: [],
        cleaning: [byName['Akash'], byName['Veera']]
      }
    }
  );

  await ChoreSchedule.findOneAndUpdate(
    { day: 'Sunday' },
    {
      $set: {
        morningCooking: [byName['Robert'], byName['Akash']],
        nightCooking: [],
        cleaning: [byName['Bhuvi🦁'], byName['Dhanesh']]
      }
    }
  );

  console.log('Weekend updated successfully!');
  await mongoose.disconnect();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
