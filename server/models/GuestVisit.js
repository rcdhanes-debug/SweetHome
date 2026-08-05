const mongoose = require('mongoose');

const guestVisitSchema = new mongoose.Schema(
  {
    guestName: { type: String, required: true, trim: true, maxlength: 80 },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    host: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('GuestVisit', guestVisitSchema);
