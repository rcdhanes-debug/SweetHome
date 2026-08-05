const cron = require('node-cron');
const funding = require('../services/fundingService');
const { HOUSEHOLD_TZ } = require('../utils/time');

// Run at 00:00 IST on the 1st of every month.
function startMonthlyJobs() {
  const job = cron.schedule(
    '0 0 1 * *',
    async () => {
      console.log('[cron] Monthly funding rollover triggered.');
      try {
        await funding.ensureNextMonthCycle();
        console.log('[cron] New funding cycle created for the new month.');
      } catch (err) {
        console.error('[cron] Monthly rollover failed:', err.message);
      }
    },
    { timezone: HOUSEHOLD_TZ }
  );
  console.log(`[cron] Monthly rollover scheduled: 00:00 on the 1st (${HOUSEHOLD_TZ}).`);
  return job;
}

module.exports = { startMonthlyJobs };
