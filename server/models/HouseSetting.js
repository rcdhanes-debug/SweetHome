const mongoose = require('mongoose');

const houseSettingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: 'common_account' },
    upiId: { type: String, default: 'sweethome@okaxis' },
    qrImage: { type: String, default: '/sweethome_upi_qr.png' },
    telegramBotToken: { type: String, default: '8826854405:AAEiAp1cYzpSWhH5xcuxSnoAUv64JA5tWIY' },
    telegramChatId: { type: String, default: '-5311138217' },
    telegramEnabled: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('HouseSetting', houseSettingSchema);
