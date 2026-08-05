require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 5000,
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/homehq',
  JWT_SECRET: process.env.JWT_SECRET || 'homehq-dev-secret-change-me',
  TOKEN_TTL: Number(process.env.TOKEN_TTL || 300),
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  TIMEZONE: process.env.HOUSEHOLD_TZ || 'Asia/Kolkata',
  LOG_LEVEL: process.env.LOG_LEVEL || 'dev',
  AUTO_SEED: process.env.AUTO_SEED !== 'false',
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '8826854405:AAEiAp1cYzpSWhH5xcuxSnoAUv64JA5tWIY',
  TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID || '-5311138217'
};
