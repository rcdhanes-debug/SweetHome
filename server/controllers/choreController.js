const chores = require('../services/choreService');
const audit = require('../services/auditService');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { DAYS } = require('../utils/constants');

const list = asyncHandler(async (req, res) => {
  res.json(await chores.listAll());
});

const today = asyncHandler(async (req, res) => {
  res.json(await chores.getToday());
});

const updateDay = asyncHandler(async (req, res) => {
  const { day } = req.params;
  if (!DAYS.includes(day)) throw new AppError('Invalid day.', 400);

  const { cooking, cleaning, homeClean } = req.body || {};
  const result = await chores.updateDay({
    day,
    cooking,
    cleaning,
    homeClean,
    updatedBy: req.user._id
  });

  await audit.log({
    action: 'CHORE_UPDATED',
    performedBy: req.user._id,
    details: { day, before: result.before, after: result.after }
  });

  res.json(result.after);
});

const swap = asyncHandler(async (req, res) => {
  const { day, personA, personB } = req.body || {};
  if (!DAYS.includes(day)) throw new AppError('Invalid day.', 400);
  if (!personA || !personB) throw new AppError('Select two people to swap.', 400);

  const result = await chores.swapUsers({ day, personA, personB, updatedBy: req.user._id });

  await audit.log({
    action: 'CHORE_SWAP',
    performedBy: req.user._id,
    targetUser: personA,
    details: { day, ...result.before }
  });

  res.json(result.after);
});

const restoreDefault = asyncHandler(async (req, res) => {
  const schedules = await chores.restoreDefault(req.user._id);

  await audit.log({
    action: 'CHORE_DEFAULT_RESTORED',
    performedBy: req.user._id
  });

  res.json(schedules);
});

module.exports = { list, today, updateDay, swap, restoreDefault };
