const mongoose = require('mongoose');
const { DAYS } = require('../utils/constants');

const choreScheduleSchema = new mongoose.Schema(
  {
    day: { type: String, required: true, unique: true, enum: DAYS },
    morningCooking: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    nightCooking:   [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    cleaning: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    morningFood: { type: String, default: '' },
    nightFood:   { type: String, default: '' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('ChoreSchedule', choreScheduleSchema);
