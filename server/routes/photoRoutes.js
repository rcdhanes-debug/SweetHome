const express = require('express');
const mongoose = require('mongoose');
const { requireAuth, optionalAuth, requireAdmin } = require('../middleware/auth');
const audit = require('../services/auditService');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const Photo = require('../models/Photo');
const Folder = require('../models/Folder');
const DriveLink = require('../models/DriveLink');

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

// List folders with counts & cover previews
router.get(
  '/folders',
  asyncHandler(async (req, res) => {
    const dbFolders = await Folder.find().populate('createdBy', 'name').lean();
    const photoAgg = await Photo.aggregate([
      { $group: { _id: '$folder', count: { $sum: 1 }, latestCover: { $last: '$data' } } }
    ]);

    const folderMap = new Map();
    // Default folders
    const defaults = ['General', 'Trips & Events', 'House Parties', 'Daily Moments'];
    defaults.forEach((name) => {
      folderMap.set(name, { name, count: 0, cover: null, color: '#6366f1', description: 'Sweet Home memories' });
    });

    dbFolders.forEach((f) => {
      folderMap.set(f.name, {
        _id: f._id,
        name: f.name,
        color: f.color || '#6366f1',
        description: f.description || '',
        count: 0,
        cover: null,
        createdBy: f.createdBy ? { _id: f.createdBy._id, name: f.createdBy.name } : null
      });
    });

    photoAgg.forEach((agg) => {
      const name = !agg._id || String(agg._id).trim() === '' ? 'General' : agg._id;
      const existing = folderMap.get(name) || { name, count: 0, cover: null, color: '#6366f1', description: 'Sweet Home memories' };
      existing.count = (existing.count || 0) + agg.count;
      if (!existing.cover) existing.cover = agg.latestCover;
      folderMap.set(name, existing);
    });

    res.json(Array.from(folderMap.values()));
  })
);

// Create folder
router.post(
  '/folders',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { name, color, description } = req.body || {};
    const cleanName = String(name || '').trim();
    if (!cleanName) throw new AppError('Folder name is required.', 400);

    let folder = await Folder.findOne({ name: cleanName });
    if (folder) throw new AppError('Folder with this name already exists.', 409);

    folder = await Folder.create({
      name: cleanName,
      color: color || '#6366f1',
      description: String(description || '').trim(),
      createdBy: req.user ? req.user._id : null
    });

    res.status(201).json(folder);
  })
);

// Delete folder
router.delete(
  '/folders/:name',
  requireAuth,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const folderName = req.params.name;
    if (folderName === 'General') throw new AppError('Cannot delete the default General folder.', 400);

    await Folder.deleteOne({ name: folderName });
    // Move photos in this folder to General
    await Photo.updateMany({ folder: folderName }, { folder: 'General' });

    res.json({ message: `Folder "${folderName}" deleted. Photos moved to General.` });
  })
);

// List Drive Links
router.get(
  '/drive-links',
  asyncHandler(async (req, res) => {
    const links = await DriveLink.find().populate('createdBy', 'name').sort({ createdAt: -1 }).lean();
    res.json(links);
  })
);

// Create Drive Link
router.post(
  '/drive-links',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { title, url, description } = req.body || {};
    const cleanTitle = String(title || '').trim();
    const cleanUrl = String(url || '').trim();
    if (!cleanTitle) throw new AppError('Drive link title is required.', 400);
    if (!cleanUrl || !/^https?:\/\//i.test(cleanUrl)) throw new AppError('Valid Google Drive URL (http/https) is required.', 400);

    const link = await DriveLink.create({
      title: cleanTitle,
      url: cleanUrl,
      description: String(description || '').trim(),
      createdBy: req.user ? req.user._id : null
    });

    await audit.log({
      action: 'DRIVE_LINK_CREATED',
      performedBy: req.user ? req.user._id : null,
      details: { title: link.title, url: link.url }
    });

    res.status(201).json(link);
  })
);

// Delete Drive Link
router.delete(
  '/drive-links/:id',
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw new AppError('Drive link not found.', 404);
    const link = await DriveLink.findById(req.params.id);
    if (!link) throw new AppError('Drive link not found.', 404);

    await link.deleteOne();
    res.json({ message: 'Drive link deleted.', id: link._id });
  })
);

// List photos (public, optional ?folder=...)
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.folder) {
      filter.folder = req.query.folder;
    }

    const photos = await Photo.find(filter)
      .select('_id originalName mime size folder caption createdAt data uploadedBy')
      .populate('uploadedBy', 'name')
      .sort({ createdAt: -1 });

    res.json(
      photos.map((p) => ({
        _id: p._id,
        name: p.originalName,
        mime: p.mime,
        size: p.size,
        folder: p.folder || 'General',
        caption: p.caption || '',
        uploadedAt: p.createdAt,
        uploadedBy: p.uploadedBy ? { _id: p.uploadedBy._id, name: p.uploadedBy.name } : null,
        src: p.data || `/api/photos/${p._id}/file`
      }))
    );
  })
);

// Upload photo
router.post(
  '/',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { data, name, folder, caption } = req.body || {};
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

    const photoFolder = String(folder || 'General').trim();

    // Ensure folder exists in Folder collection if custom
    if (photoFolder && photoFolder !== 'General') {
      const exists = await Folder.findOne({ name: photoFolder });
      if (!exists) {
        await Folder.create({ name: photoFolder, createdBy: req.user ? req.user._id : null });
      }
    }

    const photo = await Photo.create({
      data,
      originalName: String(name || '').slice(0, 120),
      mime,
      size: buffer.length,
      folder: photoFolder,
      caption: String(caption || '').slice(0, 300),
      uploadedBy: req.user ? req.user._id : null
    });

    await audit.log({
      action: 'PHOTO_ADDED',
      performedBy: req.user ? req.user._id : null,
      details: { photoId: photo._id, folder: photo.folder, bytes: buffer.length }
    });

    res.status(201).json({
      _id: photo._id,
      name: photo.originalName,
      folder: photo.folder,
      caption: photo.caption,
      uploadedAt: photo.createdAt,
      src: photo.data || `/api/photos/${photo._id}/file`
    });
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

// Delete a photo from MongoDB Cloud (anyone)
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw new AppError('Photo not found.', 404);
    const photo = await Photo.findById(req.params.id);
    if (!photo) throw new AppError('Photo not found.', 404);

    await photo.deleteOne();

    await audit.log({
      action: 'PHOTO_DELETED',
      performedBy: req.user ? req.user._id : null,
      details: { photoId: photo._id }
    });

    res.json({ message: 'Photo deleted.', id: photo._id });
  })
);

module.exports = router;
