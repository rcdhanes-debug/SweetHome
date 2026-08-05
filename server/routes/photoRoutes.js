const express = require('express');
const mongoose = require('mongoose');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const audit = require('../services/auditService');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const Photo = require('../models/Photo');

const MAX_BYTES = 12 * 1024 * 1024;
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];

function sniffImage(buffer) {
  if (!buffer || buffer.length < 12) return null;
  const hex = buffer.toString('hex', 0, 12).toUpperCase();
  if (hex.startsWith('FFD8FF')) return 'image/jpeg';
  if (hex.startsWith('89504E470D0A1A0A')) return 'image/png';
  if (hex.slice(0, 8) === '52494646' && hex.slice(16, 24) === '57454250') return 'image/webp';
  return null;
}

const router = express.Router();

// List photos (public)
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const photos = await Photo.find().select('_id originalName mime size createdAt').sort({ createdAt: -1 });
    res.json(
      photos.map((p) => ({
        _id: p._id,
        name: p.originalName,
        mime: p.mime,
        size: p.size,
        uploadedAt: p.createdAt,
        src: `/api/photos/${p._id}/file`
      }))
    );
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { data, name } = req.body || {};
    if (typeof data !== 'string' || !/^data:image\//.test(data)) {
      throw new AppError('Please choose a valid image (JPEG, PNG, or WebP).', 400);
    }

    const b64 = data.slice(data.indexOf(',') + 1);
    if (!/^[A-Za-z0-9+/=]+$/.test(b64)) throw new AppError('Invalid image data.', 400);

    const buffer = Buffer.from(b64, 'base64');
    if (buffer.length === 0) throw new AppError('Empty image file.', 400);
    if (buffer.length > MAX_BYTES) throw new AppError('Image is too large. Maximum size is 12 MB.', 400);

    const mime = sniffImage(buffer);
    if (!mime || !ALLOWED_MIME.includes(mime)) throw new AppError('Only JPEG, PNG, or WebP images are allowed.', 400);

    const photo = await Photo.create({
      data,
      originalName: String(name || '').slice(0, 120),
      mime,
      size: buffer.length,
      uploadedBy: req.user ? req.user._id : null
    });

    await audit.log({
      action: 'PHOTO_ADDED',
      performedBy: req.user ? req.user._id : null,
      details: { photoId: photo._id, bytes: buffer.length }
    });

    res.status(201).json({ _id: photo._id, name: photo.originalName, src: `/api/photos/${photo._id}/file` });
  })
);

// Serve photo file directly from MongoDB Cloud document
router.get(
  '/:id/file',
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw new AppError('Photo not found.', 404);
    const photo = await Photo.findById(req.params.id);
    if (!photo || !photo.data) throw new AppError('Photo not found.', 404);

    const idx = photo.data.indexOf(',');
    const b64 = idx >= 0 ? photo.data.slice(idx + 1) : photo.data;
    const buf = Buffer.from(b64, 'base64');

    res.setHeader('Content-Type', photo.mime || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(buf);
  })
);

// Delete a photo from MongoDB Cloud (admin)
router.delete(
  '/:id',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw new AppError('Photo not found.', 404);
    const photo = await Photo.findById(req.params.id);
    if (!photo) throw new AppError('Photo not found.', 404);

    await photo.deleteOne();

    await audit.log({
      action: 'PHOTO_DELETED',
      performedBy: req.user._id,
      details: { photoId: photo._id }
    });

    res.json({ message: 'Photo deleted.', id: photo._id });
  })
);

module.exports = router;
