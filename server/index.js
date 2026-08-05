require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');
const { PORT, AUTO_SEED } = require('./config');
const { seedAll } = require('./seed/seedData');
const { startMonthlyJobs } = require('./jobs/monthlyReset');
const { startReminderJobs } = require('./jobs/reminders');
const { startKeepAlive } = require('./services/keepAliveService');
const { startBotPolling } = require('./services/telegramBot');

(async () => {
  await connectDB();

  if (AUTO_SEED) {
    try {
      await seedAll({ force: false });
      console.log('[boot] Bootstrap seed completed (idempotent).');
    } catch (err) {
      console.error('[boot] Bootstrap seed failed:', err.message);
    }
  }

  startMonthlyJobs();
  startReminderJobs();
  startKeepAlive();
  startBotPolling();

  app.listen(PORT, () => {
    console.log(`Sweet Home API listening on http://localhost:${PORT}`);
  });
})();
