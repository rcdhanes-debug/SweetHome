const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 80 },
    type: { type: String, enum: ['birthday', 'festival', 'outing', 'house', 'other'], default: 'other' },
    date: { type: Date, required: true },
    allDay: { type: Boolean, default: true },
    time: { type: String, default: '' },
    location: { type: String, default: '', maxlength: 120 },
    notes: { type: String, default: '', maxlength: 500 },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

eventSchema.index({ date: 1, createdAt: -1 });

module.exports = mongoose.model('Event', eventSchema);
