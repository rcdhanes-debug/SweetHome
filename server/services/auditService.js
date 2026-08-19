const AuditLog = require('../models/AuditLog');
const Notification = require('../models/Notification');
const User = require('../models/User');

const ACTION_TITLES = {
  EXPENSE_CREATED: '💸 New Expense Added',
  EXPENSE_DELETED: '🗑️ Expense Removed',
  REDEEM_CREATED: '🤝 Redeem Request Raised',
  REDEEM_CLOSED: '✅ Redeem Request Settled',
  REDEEM_REOPENED: '🔄 Redeem Request Reopened',
  REDEEM_DELETED: '🗑️ Redeem Request Removed',
  CONTRIBUTION_PAID: '💰 Monthly Contribution Paid',
  CONTRIBUTION_RESET: '🔄 Payment Status Reset',
  CHORE_SWAP: '🔄 Chore Swap Recorded',
  CHORE_UPDATED: '📅 Chore Schedule Updated',
  PHOTO_ADDED: '🖼️ New Gallery Memory',
  PHOTO_DELETED: '🗑️ Memory Removed',
  PIN_CHANGED: '🔐 Security PIN Changed',
  USER_PROFILE_UPDATED: '👤 Profile Handle Updated',
  COMMON_ACCOUNT_UPDATED: '💳 Common Account Updated',
  FUNDING_AMOUNT_SET: '💵 Monthly Target Updated'
};

async function log({ action, performedBy = null, targetUser = null, details = {} }) {
  try {
    await AuditLog.create({ action, performedBy, targetUser, details });

    // Auto-record user activity as a Notification
    let actorName = 'Someone';
    if (performedBy) {
      const u = await User.findById(performedBy).select('name');
      if (u) actorName = u.name;
    }

    let detailStr = '';
    if (details.amount) detailStr += ` ₹${details.amount}`;
    if (details.category) detailStr += ` (${details.category})`;
    if (details.name) detailStr += ` for ${details.name}`;
    if (details.closedBy) detailStr += ` by ${details.closedBy}`;
    if (details.aName && details.bName) detailStr += `: ${details.aName} ↔ ${details.bName}`;

    const title = ACTION_TITLES[action] || action.replace(/_/g, ' ');
    const message = `${actorName} performed: ${action.replace(/_/g, ' ').toLowerCase()}.${detailStr}`;

    await Notification.create({
      type: action,
      title,
      message,
      createdBy: performedBy
    });

    // Trigger live Telegram notifications for balance changes and redeem requests
    try {
      const telegram = require('./telegramService');
      if (['EXPENSE_CREATED', 'EXPENSE_DELETED', 'CONTRIBUTION_PAID', 'CONTRIBUTION_RESET', 'FUNDING_AMOUNT_SET', 'COMMON_ACCOUNT_UPDATED', 'ROLLOVER_AMOUNT_SET'].includes(action)) {
        telegram.sendRemainingMoneyNotification().catch(() => {});
      } else if (action === 'REDEEM_CREATED') {
        if (details && details.id) {
          telegram.sendNewRedeemNotification(details.id).catch(() => {});
        } else {
          telegram.sendUnpaidRedeemReminder().catch(() => {});
        }
      } else if (action === 'REDEEM_CLOSED') {
        if (details && details.id) {
          telegram.sendRedeemClosedNotification(details.id, details.closedBy).catch(() => {});
        }
      }
    } catch (_) {}
  } catch (err) {
    console.error('Failed to write audit log/notification:', err.message);
  }
}

async function listRecent(limit = 100) {
  return AuditLog.find()
    .sort({ timestamp: -1 })
    .limit(limit)
    .populate('performedBy', 'name')
    .populate('targetUser', 'name');
}

module.exports = { log, listRecent };
