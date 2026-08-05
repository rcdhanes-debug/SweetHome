const mongoose = require('mongoose');
const { DAYS } = require('../utils/constants');

const choreScheduleSchema = new mongoose.Schema(
  {
    day: { type: String, required: true, unique: true, enum: DAYS },
    cooking: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    cleaning: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    homeClean: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('ChoreSchedule', choreScheduleSchema);
