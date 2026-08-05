const router = require('express').Router();
const {
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
} = require('../controllers/noticeController');
const { requireAuth, requireAdmin } = require('../middleware/auth');

router.get('/', getBoard);

// Shared shopping list
router.post('/shopping', requireAuth, addShopping);
router.patch('/shopping/:id', requireAuth, updateShopping);
router.delete('/shopping/:id', requireAuth, deleteShopping);

// Fix-It log
router.post('/fixes', requireAuth, addFix);
router.patch('/fixes/:id', requireAuth, setFix);
router.delete('/fixes/:id', requireAuth, deleteFix);

// Guest protocol
router.post('/guests', requireAuth, addGuest);
router.delete('/guests/:id', requireAuth, deleteGuest);

// House resolutions
router.post('/resolutions', requireAuth, createResolution);
router.post('/resolutions/:id/vote', requireAuth, voteResolution);
router.patch('/resolutions/:id/close', requireAuth, requireAdmin, closeResolution);
router.patch('/resolutions/:id/reopen', requireAuth, requireAdmin, reopenResolution);
router.delete('/resolutions/:id', requireAuth, requireAdmin, deleteResolution);

module.exports = router;
