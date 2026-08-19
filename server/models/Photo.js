const mongoose = require('mongoose');

const photoSchema = new mongoose.Schema(
  {
    filename: { type: String, default: '' },
    originalName: { type: String, default: '' },
    mime: { type: String, default: 'image/jpeg' },
    size: { type: Number, default: 0 },
    data: { type: String, required: true },
    folder: { type: String, default: 'General', index: true },
    caption: { type: String, default: '' },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Photo', photoSchema);
