const mongoose = require('mongoose');

const driveLinkSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    folder: { type: String, default: 'Google Drive Links' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('DriveLink', driveLinkSchema);
