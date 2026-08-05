const board = require('../services/noticeService');
const audit = require('../services/auditService');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

const getBoard = asyncHandler(async (req, res) => {
  res.json(await board.getBoard());
});

// ─── Shopping list ──────────────────────────────────────────
const addShopping = asyncHandler(async (req, res) => {
  const item = await board.addShoppingItem({ text: req.body?.text, createdBy: req.user._id });
  await audit.log({ action: 'SHOPPING_ADDED', performedBy: req.user._id, details: { text: item.text } });
  res.status(201).json(item);
});

const updateShopping = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { text, checked } = req.body || {};
  const item = await board.updateShoppingItem(id, { text, checked, performedBy: req.user._id });
  await audit.log({
    action: checked !== undefined ? 'SHOPPING_TOGGLED' : 'SHOPPING_EDITED',
    performedBy: req.user._id,
    details: { text: item.text, checked: item.checked }
  });
  res.json(item);
});

const deleteShopping = asyncHandler(async (req, res) => {
  const item = await board.deleteShoppingItem(req.params.id);
  await audit.log({ action: 'SHOPPING_DELETED', performedBy: req.user._id, details: { text: item.text } });
  res.json({ message: 'Item removed.' });
});

// ─── Fix-It log ─────────────────────────────────────────────
const addFix = asyncHandler(async (req, res) => {
  const ticket = await board.addFixTicket({
    title: req.body?.title,
    description: req.body?.description,
    createdBy: req.user._id
  });
  await audit.log({ action: 'FIX_OPENED', performedBy: req.user._id, details: { title: ticket.title } });
  res.status(201).json(ticket);
});

const setFix = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { resolved } = req.body || {};
  const ticket = await board.setFixResolved(id, { resolved, performedBy: req.user._id });
  await audit.log({
    action: resolved ? 'FIX_RESOLVED' : 'FIX_REOPENED',
    performedBy: req.user._id,
    details: { title: ticket.title }
  });
  res.json(ticket);
});

const deleteFix = asyncHandler(async (req, res) => {
  const ticket = await board.deleteFixTicket(req.params.id);
  await audit.log({ action: 'FIX_DELETED', performedBy: req.user._id, details: { title: ticket.title } });
  res.json({ message: 'Issue removed.' });
});

// ─── Guest protocol ─────────────────────────────────────────
const addGuest = asyncHandler(async (req, res) => {
  const { guestName, startDate, endDate } = req.body || {};
  const visit = await board.addGuestVisit({ guestName, startDate, endDate, host: req.user._id });
  await audit.log({ action: 'GUEST_ADDED', performedBy: req.user._id, details: { guestName: visit.guestName } });
  res.status(201).json(visit);
});

const deleteGuest = asyncHandler(async (req, res) => {
  const visit = await board.deleteGuestVisit(req.params.id);
  await audit.log({ action: 'GUEST_REMOVED', performedBy: req.user._id, details: { guestName: visit.guestName } });
  res.json({ message: 'Guest visit removed.' });
});

// ─── House resolutions ──────────────────────────────────────
const createResolution = asyncHandler(async (req, res) => {
  const resolution = await board.createResolution({
    title: req.body?.title,
    options: req.body?.options,
    createdBy: req.user._id
  });
  await audit.log({ action: 'RESOLUTION_CREATED', performedBy: req.user._id, details: { title: resolution.title } });
  res.status(201).json(resolution);
});

const voteResolution = asyncHandler(async (req, res) => {
  const resolution = await board.voteOnResolution({
    id: req.params.id,
    option: req.body?.option,
    voter: req.user._id
  });
  await audit.log({ action: 'RESOLUTION_VOTED', performedBy: req.user._id, details: { title: resolution.title } });
  res.json(resolution);
});

const closeResolution = asyncHandler(async (req, res) => {
  const resolution = await board.setResolutionClosed(req.params.id, true);
  await audit.log({ action: 'RESOLUTION_CLOSED', performedBy: req.user._id, details: { title: resolution.title } });
  res.json(resolution);
});

const reopenResolution = asyncHandler(async (req, res) => {
  const resolution = await board.setResolutionClosed(req.params.id, false);
  await audit.log({ action: 'RESOLUTION_REOPENED', performedBy: req.user._id, details: { title: resolution.title } });
  res.json(resolution);
});

const deleteResolution = asyncHandler(async (req, res) => {
  const resolution = await board.deleteResolution(req.params.id);
  await audit.log({ action: 'RESOLUTION_DELETED', performedBy: req.user._id, details: { title: resolution.title } });
  res.json({ message: 'Resolution removed.' });
});

module.exports = {
  getBoard,
  addShopping,
  updateShopping,
  deleteShopping,
  addFix,
  setFix,
  deleteFix,
  addGuest,
  deleteGuest,
  createResolution,
  voteResolution,
  closeResolution,
  reopenResolution,
  deleteResolution
};
