const mongoose = require('mongoose');

const fundingSettingSchema = new mongoose.Schema(
  {
    month: { type: String, required: true, unique: true },
    contributionAmount: { type: Number, required: true, min: 1 }
  },
  { timestamps: true }
);

module.exports = mongoose.model('FundingSetting', fundingSettingSchema);
