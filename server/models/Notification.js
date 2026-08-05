const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    type: { type: String, default: 'GENERAL' },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    message: { type: String, default: '', maxlength: 500 },
    month: { type: String, default: '' },
    refId: { type: String, default: '' },
    read: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { timestamps: true }
);

notificationSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
