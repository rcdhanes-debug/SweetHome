/**
 * Bank Sync Jobs
 * System is switched to instant real-time SMS notifications via mobile SMS Forwarder webhook (/api/bank/sms-webhook).
 * Background IMAP email polling is disabled by default in favor of instant webhook processing.
 */

function startBankSyncJobs() {
  console.log('[BankSync] Real-time SMS webhook listener active on /api/bank/sms-webhook. Mobile forwarder notifications will update balances instantly.');
}

module.exports = { startBankSyncJobs };
