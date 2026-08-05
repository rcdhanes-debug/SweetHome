const ShoppingItem = require('../models/ShoppingItem');
const FixTicket = require('../models/FixTicket');
const GuestVisit = require('../models/GuestVisit');
const Resolution = require('../models/Resolution');
const AppError = require('../utils/AppError');

async function getBoard() {
  const [shopping, fixes, guests, resolutions] = await Promise.all([
    ShoppingItem.find().sort({ createdAt: -1 }).populate('createdBy', 'name').populate('checkedBy', 'name'),
    FixTicket.find().sort({ createdAt: -1 }).populate('createdBy', 'name').populate('resolvedBy', 'name'),
    GuestVisit.find().sort({ startDate: 1 }).populate('host', 'name'),
    Resolution.find().sort({ createdAt: -1 }).populate('createdBy', 'name').populate('votes.user', 'name')
  ]);
  return { shopping, fixes, guests, resolutions };
}

async function addShoppingItem({ text, createdBy }) {
  const clean = String(text || '').trim();
  if (!clean) throw new AppError('Shopping item cannot be empty.', 400);
  const item = await ShoppingItem.create({ text: clean, createdBy });
  return ShoppingItem.findById(item._id).populate('createdBy', 'name');
}

async function updateShoppingItem(id, { text, checked, performedBy }) {
  const item = await ShoppingItem.findById(id);
  if (!item) throw new AppError('Shopping item not found.', 404);

  if (text !== undefined) {
    const clean = String(text || '').trim();
    if (!clean) throw new AppError('Shopping item cannot be empty.', 400);
    item.text = clean;
  }
  if (checked !== undefined) {
    item.checked = Boolean(checked);
    item.checkedBy = Boolean(checked) ? performedBy : null;
    item.checkedAt = Boolean(checked) ? new Date() : null;
  }
  await item.save();
  return ShoppingItem.findById(item._id).populate('createdBy', 'name').populate('checkedBy', 'name');
}

async function deleteShoppingItem(id) {
  const item = await ShoppingItem.findById(id);
  if (!item) throw new AppError('Shopping item not found.', 404);
  await item.deleteOne();
  return item;
}

async function addFixTicket({ title, description, createdBy }) {
  const cleanTitle = String(title || '').trim();
  if (!cleanTitle) throw new AppError('Fix-It issue title is required.', 400);
  const ticket = await FixTicket.create({
    title: cleanTitle,
    description: String(description || '').trim(),
    createdBy
  });
  return FixTicket.findById(ticket._id).populate('createdBy', 'name');
}

async function setFixResolved(id, { resolved, performedBy }) {
  const ticket = await FixTicket.findById(id);
  if (!ticket) throw new AppError('Fix-It issue not found.', 404);

  ticket.resolved = Boolean(resolved);
  ticket.resolvedBy = Boolean(resolved) ? performedBy : null;
  ticket.resolvedAt = Boolean(resolved) ? new Date() : null;
  await ticket.save();
  return FixTicket.findById(ticket._id).populate('createdBy', 'name').populate('resolvedBy', 'name');
}

async function deleteFixTicket(id) {
  const ticket = await FixTicket.findById(id);
  if (!ticket) throw new AppError('Fix-It issue not found.', 404);
  await ticket.deleteOne();
  return ticket;
}

async function addGuestVisit({ guestName, startDate, endDate, host }) {
  const clean = String(guestName || '').trim();
  if (!clean) throw new AppError('Guest name is required.', 400);

  const start = startDate ? new Date(startDate) : null;
  const end = endDate ? new Date(endDate) : null;
  if (!start || Number.isNaN(start.getTime())) throw new AppError('Start date is invalid.', 400);
  if (!end || Number.isNaN(end.getTime())) throw new AppError('End date is invalid.', 400);
  if (end < start) throw new AppError('End date must be after the start date.', 400);

  const visit = await GuestVisit.create({ guestName: clean, startDate: start, endDate: end, host });
  return GuestVisit.findById(visit._id).populate('host', 'name');
}

async function deleteGuestVisit(id) {
  const visit = await GuestVisit.findById(id);
  if (!visit) throw new AppError('Guest visit not found.', 404);
  await visit.deleteOne();
  return visit;
}

async function createResolution({ title, options, createdBy }) {
  const cleanTitle = String(title || '').trim();
  if (!cleanTitle) throw new AppError('Resolution title is required.', 400);

  const cleanOptions = (options || [])
    .map((o) => String(o).trim())
    .filter(Boolean)
    .filter((v, i, arr) => arr.indexOf(v) === i);
  if (cleanOptions.length < 2) throw new AppError('Add at least two options.', 400);
  if (cleanOptions.length > 8) throw new AppError('Maximum 8 options allowed.', 400);

  const resolution = await Resolution.create({ title: cleanTitle, options: cleanOptions, createdBy });
  return Resolution.findById(resolution._id).populate('createdBy', 'name').populate('votes.user', 'name');
}

async function voteOnResolution(id, { option, voter }) {
  const resolution = await Resolution.findById(id);
  if (!resolution) throw new AppError('Resolution not found.', 404);
  if (resolution.closed) throw new AppError('This resolution is closed.', 400);

  const clean = String(option || '').trim();
  if (!resolution.options.includes(clean)) throw new AppError('That is not a valid option.', 400);

  const existing = resolution.votes.find((v) => String(v.user) === String(voter));
  if (existing) existing.option = clean;
  else resolution.votes.push({ user: voter, option: clean });

  await resolution.save();
  return Resolution.findById(resolution._id).populate('createdBy', 'name').populate('votes.user', 'name');
}

async function setResolutionClosed(id, closed) {
  const resolution = await Resolution.findById(id);
  if (!resolution) throw new AppError('Resolution not found.', 404);
  resolution.closed = Boolean(closed);
  await resolution.save();
  return Resolution.findById(resolution._id).populate('createdBy', 'name').populate('votes.user', 'name');
}

async function deleteResolution(id) {
  const resolution = await Resolution.findById(id);
  if (!resolution) throw new AppError('Resolution not found.', 404);
  await resolution.deleteOne();
  return resolution;
}

module.exports = {
  getBoard,
  addShoppingItem,
  updateShoppingItem,
  deleteShoppingItem,
  addFixTicket,
  setFixResolved,
  deleteFixTicket,
  addGuestVisit,
  deleteGuestVisit,
  createResolution,
  voteOnResolution,
  setResolutionClosed,
  deleteResolution
};
