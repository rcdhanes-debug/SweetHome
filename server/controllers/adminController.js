const audit = require('../services/auditService');
const telegram = require('../services/telegramService');
const asyncHandler = require('../utils/asyncHandler');

const auditLogs = asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit || 100), 500);
  const logs = await audit.listRecent(limit);
  res.json(
    logs.map((l) => ({
      _id: l._id,
      action: l.action,
      performedBy: l.performedBy ? { _id: l.performedBy._id, name: l.performedBy.name } : null,
      targetUser: l.targetUser ? { _id: l.targetUser._id, name: l.targetUser.name } : null,
      details: l.details || {},
      timestamp: l.timestamp
    }))
  );
});

const getTelegramConfig = asyncHandler(async (req, res) => {
  res.json(await telegram.getTelegramConfig());
});

const updateTelegramConfig = asyncHandler(async (req, res) => {
  const { token, chatId, enabled } = req.body || {};
  res.json(await telegram.updateTelegramConfig({ token, chatId, enabled }));
});

const sendTelegramTest = asyncHandler(async (req, res) => {
  const { token, chatId } = req.body || {};
  await telegram.sendTestMessage(token, chatId);
  res.json({ ok: true });
});

const sendTomorrowChoresTest = asyncHandler(async (req, res) => {
  const sent = await telegram.sendTomorrowChoresNotification();
  res.json({ ok: sent });
});

const sendRemainingMoneyTest = asyncHandler(async (req, res) => {
  const sent = await telegram.sendRemainingMoneyNotification();
  res.json({ ok: sent });
});

module.exports = {
  auditLogs,
  getTelegramConfig,
  updateTelegramConfig,
  sendTelegramTest,
  sendTomorrowChoresTest,
  sendRemainingMoneyTest
};
