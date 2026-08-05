const mongoose = require('mongoose');

const voteSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    option: { type: String, required: true, trim: true }
  },
  { _id: false }
);

const resolutionSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 160 },
    options: [{ type: String, required: true, trim: true, maxlength: 60 }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    closed: { type: Boolean, default: false },
    votes: [voteSchema]
  },
  { timestamps: true }
);

module.exports = mongoose.model('Resolution', resolutionSchema);
