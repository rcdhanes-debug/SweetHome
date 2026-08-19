import { useState, useEffect, useCallback, useRef } from 'react';
import {
  FolderPlus,
  Upload,
  Image as ImageIcon,
  Folder as FolderIcon,
  Trash2,
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  Search,
  Sparkles,
  Plus,
  Tag,
  Clock,
  User,
  SlidersHorizontal,
  Check,
  Loader2,
  Link2,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import * as photoApi from '../services/photo';
import BottomSheet from '../components/BottomSheet';
import Skeleton from '../components/Skeleton';
import EmptyState from '../components/EmptyState';
import ConfirmModal from '../components/ConfirmModal';
import Avatar from '../components/Avatar';
import { formatDate, formatDateTime } from '../utils/format';

const FOLDER_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

export default function Memories() {
  const { session, isAdmin, runWithAuth } = useAuth();
  const toast = useToast();
  const reduced = useReducedMotion();

  const [photos, setPhotos] = useState([]);
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFolder, setActiveFolder] = useState('ALL');
  const [search, setSearch] = useState('');
  const [displayLimit, setDisplayLimit] = useState(10);

  useEffect(() => {
    setDisplayLimit(10);
  }, [activeFolder, search]);

  // Upload modal
  const [showUpload, setShowUpload] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [targetFolder, setTargetFolder] = useState('General');
  const [captionInput, setCaptionInput] = useState('');
  const [uploadBusy, setUploadBusy] = useState(false);

  // New folder modal
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [folderColor, setFolderColor] = useState('#6366f1');
  const [folderDesc, setFolderDesc] = useState('');
  const [folderBusy, setFolderBusy] = useState(false);

  // Google Drive Links state
  const [driveLinks, setDriveLinks] = useState([]);
  const [showDriveModal, setShowDriveModal] = useState(false);
  const [driveTitle, setDriveTitle] = useState('');
  const [driveUrl, setDriveUrl] = useState('');
  const [driveDesc, setDriveDesc] = useState('');
  const [driveBusy, setDriveBusy] = useState(false);

  // Lightbox
  const [lightboxIndex, setLightboxIndex] = useState(-1);

  // Delete confirmations
  const [deleteTarget, setDeleteTarget] = useState(null); // photo
  const [deleteFolderTarget, setDeleteFolderTarget] = useState(null); // folder name

  const fileInputRef = useRef(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const folderRes = await photoApi.listFolders().catch((err) => {
        console.warn('Folders fetch notice:', err.message);
        return [];
      });
      const photoRes = await photoApi.listPhotos().catch((err) => {
        console.warn('Photos fetch notice:', err.message);
        return [];
      });
      const driveRes = await photoApi.listDriveLinks().catch((err) => {
        console.warn('Drive links fetch notice:', err.message);
        return [];
      });
      setFolders(Array.isArray(folderRes) ? folderRes : folderRes?.data || []);
      setPhotos(Array.isArray(photoRes) ? photoRes : photoRes?.data || []);
      setDriveLinks(Array.isArray(driveRes) ? driveRes : driveRes?.data || []);
    } catch (err) {
      console.error('Memories load error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 12 * 1024 * 1024) {
      toast.show('File is too large (max 12 MB).', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setSelectedFile(file);
      setPreviewUrl(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (file.size > 12 * 1024 * 1024) {
      toast.show('File is too large (max 12 MB).', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setSelectedFile(file);
      setPreviewUrl(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const savePhotoUpload = async () => {
    if (!previewUrl || uploadBusy) return;
    setUploadBusy(true);
    try {
      const token = session?.token;
      await photoApi.uploadPhoto(
        token,
        previewUrl,
        selectedFile?.name || 'memory.jpg',
        targetFolder,
        captionInput
      );
      toast.show('✨ Memory uploaded to gallery!');
      setShowUpload(false);
      setSelectedFile(null);
      setPreviewUrl('');
      setCaptionInput('');
      await loadData();
    } catch (err) {
      toast.show(err.response?.data?.message || err.message || 'Failed to upload photo', 'error');
    } finally {
      setUploadBusy(false);
    }
  };

  const saveNewFolder = async () => {
    const clean = folderName.trim();
    if (!clean) {
      toast.show('Folder name is required', 'error');
      return;
    }
    setFolderBusy(true);
    try {
      const token = session?.token;
      await photoApi.createFolder(token, clean, folderColor, folderDesc);
      toast.show(`✓ Folder "${clean}" created`);
      setShowNewFolder(false);
      setFolderName('');
      setFolderDesc('');
      setActiveFolder(clean);
      setTargetFolder(clean);
      await loadData();
    } catch (err) {
      toast.show(err.response?.data?.message || err.message || 'Failed to create folder', 'error');
    } finally {
      setFolderBusy(false);
    }
  };

  const confirmDeletePhoto = async () => {
    if (!deleteTarget) return;
    try {
      await photoApi.deletePhoto(session?.token, deleteTarget._id);
      toast.show('Memory photo deleted');
      setDeleteTarget(null);
      if (lightboxIndex >= 0) setLightboxIndex(-1);
      await loadData();
    } catch (err) {
      toast.show(err.response?.data?.message || err.message || 'Failed to delete photo', 'error');
    }
  };

  const confirmDeleteFolder = async () => {
    if (!deleteFolderTarget) return;
    try {
      await runWithAuth({ title: 'Delete Folder', subtitle: `Delete "${deleteFolderTarget}"`, adminOnly: true }, async (token) => {
        await photoApi.deleteFolder(token, deleteFolderTarget);
      });
      toast.show(`Folder "${deleteFolderTarget}" deleted`);
      setDeleteFolderTarget(null);
      if (activeFolder === deleteFolderTarget) setActiveFolder('ALL');
      await loadData();
    } catch (err) {
      if (err.message !== 'Cancelled') toast.show(err.message, 'error');
    }
  };

  const saveDriveLink = async () => {
    const cleanTitle = driveTitle.trim();
    const cleanUrl = driveUrl.trim();
    if (!cleanTitle || !cleanUrl) {
      toast.show('Title and valid Google Drive URL are required', 'error');
      return;
    }
    setDriveBusy(true);
    try {
      await photoApi.createDriveLink(session?.token, cleanTitle, cleanUrl, driveDesc);
      toast.show('✓ Google Drive link saved!');
      setShowDriveModal(false);
      setDriveTitle('');
      setDriveUrl('');
      setDriveDesc('');
      setActiveFolder('GDRIVE');
      await loadData();
    } catch (err) {
      toast.show(err.response?.data?.message || err.message || 'Failed to save Drive link', 'error');
    } finally {
      setDriveBusy(false);
    }
  };

  const confirmDeleteDriveLink = async (id) => {
    try {
      await photoApi.deleteDriveLink(session?.token, id);
      toast.show('Google Drive link removed');
      await loadData();
    } catch (err) {
      toast.show(err.response?.data?.message || err.message || 'Failed to delete link', 'error');
    }
  };

  // Filtered photos
  const filteredPhotos = photos.filter((p) => {
    const matchesFolder = activeFolder === 'ALL' || p.folder === activeFolder;
    const q = search.toLowerCase().trim();
    const matchesSearch =
      !q ||
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.caption && p.caption.toLowerCase().includes(q)) ||
      (p.folder && p.folder.toLowerCase().includes(q)) ||
      (p.uploadedBy?.name && p.uploadedBy.name.toLowerCase().includes(q));
    return matchesFolder && matchesSearch;
  });

  const activeLightboxPhoto = lightboxIndex >= 0 ? filteredPhotos[lightboxIndex] : null;

  return (
    <div className="page">
      {/* Hero Banner (Perfectly Aligned) */}
      <section className="card memory-hero" style={{ background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(139, 92, 246, 0.08) 100%)', border: '1px solid rgba(99, 102, 241, 0.25)', padding: '14px 18px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ flex: '1', minWidth: '240px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ fontSize: '18px', fontWeight: 900, margin: 0, letterSpacing: '-0.3px', color: 'var(--text)' }}>Sweet Home Gallery</h1>
              <span className="badge" style={{ background: 'rgba(99, 102, 241, 0.2)', color: '#818cf8', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                <Sparkles size={11} style={{ marginRight: '3px' }} /> Shared Memories
              </span>
            </div>
            <p className="muted" style={{ marginTop: '3px', fontSize: '12px', margin: '3px 0 0 0' }}>
              Capture and organize house memories, trip albums, party photos, and daily moments.
            </p>
          </div>

          <div className="memory-hero__actions" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              style={{ fontSize: '12px', padding: '6px 11px' }}
              onClick={() => {
                setDriveTitle('');
                setDriveUrl('');
                setDriveDesc('');
                setShowDriveModal(true);
              }}
            >
              <Link2 size={14} /> Add GDrive Link
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              style={{ fontSize: '12px', padding: '6px 11px' }}
              onClick={() => {
                setFolderName('');
                setShowNewFolder(true);
              }}
            >
              <FolderPlus size={14} /> New Folder
            </button>
            <button
              type="button"
              className="btn btn--primary btn--sm"
              style={{ fontSize: '12px', padding: '6px 12px' }}
              onClick={() => {
                setPreviewUrl('');
                setSelectedFile(null);
                setShowUpload(true);
              }}
            >
              <Upload size={14} /> Upload Photo
            </button>
          </div>
        </div>
      </section>

      {/* Folders List */}
      <section style={{ marginTop: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <h2 className="section-title" style={{ margin: 0, fontSize: '15px' }}>
            <FolderIcon size={16} /> Memory Folders
          </h2>
          <span className="badge badge--today" style={{ fontSize: '10.5px' }}>{folders.length + 1} Folders</span>
        </div>

        <div className="folder-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '8px' }}>
          {/* All Memories Card */}
          <button
            type="button"
            className={`folder-card ${activeFolder === 'ALL' ? 'folder-card--active' : ''}`}
            onClick={() => setActiveFolder('ALL')}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
              <span style={{ fontSize: '15px' }}>📂</span>
              <span className="badge" style={{ background: '#fef3c7', color: '#854d0e', fontSize: '9px', fontWeight: 800, padding: '2px 4px' }}>{photos.length}</span>
            </div>
            <div className="folder-card__name">All Memories</div>
            <div className="folder-card__count">{photos.length} photos</div>
          </button>

          {/* Google Drive Links Card */}
          <button
            type="button"
            className={`folder-card ${activeFolder === 'GDRIVE' ? 'folder-card--active' : ''}`}
            onClick={() => setActiveFolder('GDRIVE')}
            style={activeFolder === 'GDRIVE' ? { background: 'linear-gradient(135deg, #10b981 0%, #059669 100%) !important', borderColor: '#047857 !important', color: '#ffffff !important' } : {}}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
              <span style={{ fontSize: '15px' }}>🌐</span>
              <span className="badge" style={{ background: '#d1fae5', color: '#065f46', fontSize: '9px', fontWeight: 800, padding: '2px 4px' }}>{driveLinks.length}</span>
            </div>
            <div className="folder-card__name" style={activeFolder === 'GDRIVE' ? { color: '#fff' } : {}}>Google Drive</div>
            <div className="folder-card__count" style={activeFolder === 'GDRIVE' ? { color: '#e0e7ff' } : {}}>{driveLinks.length} {driveLinks.length === 1 ? 'link' : 'links'}</div>
          </button>

          {folders.map((f) => {
            const count = photos.filter((p) => (p.folder || 'General') === f.name).length;
            return (
              <div
                key={f.name}
                className={`folder-card ${activeFolder === f.name ? 'folder-card--active' : ''}`}
                onClick={() => setActiveFolder(f.name)}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span className="folder-icon-badge" style={{ color: '#854d0e', display: 'inline-flex' }}>
                    <FolderIcon size={18} />
                  </span>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="badge" style={{ background: '#fef3c7', color: '#854d0e', fontSize: '10px', fontWeight: 800 }}>{count}</span>

                    {isAdmin && f.name !== 'General' && (
                      <button
                        type="button"
                        style={{
                          background: 'rgba(180, 83, 9, 0.18)',
                          border: 'none',
                          color: '#92400e',
                          borderRadius: '6px',
                          padding: '3px 5px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer'
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteFolderTarget(f.name);
                        }}
                        title="Delete Folder"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
                <div className="folder-card__name">{f.name}</div>
                <div className="folder-card__count">{count} {count === 1 ? 'photo' : 'photos'}</div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Filter & Search Bar */}
      <section style={{ marginTop: '24px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ position: 'relative', flex: '1', minWidth: '220px' }}>
            <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
            <input
              type="text"
              className="field__input"
              style={{ paddingLeft: '40px' }}
              placeholder="Search memories by title, caption, or uploader…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--muted)' }}>
            Showing {filteredPhotos.length} {filteredPhotos.length === 1 ? 'photo' : 'photos'}
          </div>
        </div>
      </section>

      {/* Photo Gallery Grid */}
      <section style={{ marginTop: '16px' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 20px', gap: '16px' }}>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                display: 'grid',
                placeItems: 'center',
                boxShadow: '0 0 24px rgba(99, 102, 241, 0.45)'
              }}
            >
              <Loader2 size={26} color="#ffffff" />
            </motion.div>

            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text)' }}>Loading Sweet Home Gallery…</div>
              <div style={{ fontSize: '12.5px', color: 'var(--muted)', marginTop: '4px' }}>Organizing photos and memory albums</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px', width: '100%', marginTop: '16px' }}>
              <Skeleton height={180} radius={16} />
              <Skeleton height={180} radius={16} />
              <Skeleton height={180} radius={16} />
              <Skeleton height={180} radius={16} />
            </div>
          </div>
        ) : activeFolder === 'GDRIVE' ? (
          driveLinks.length === 0 ? (
            <EmptyState
              icon="📂"
              title="No Google Drive links recorded yet"
              subtitle="Click 'Add GDrive Link' to record shared Google Drive photo albums."
            />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
              {driveLinks.map((link) => (
                <div
                  key={link._id}
                  style={{
                    position: 'relative',
                    borderRadius: '16px',
                    padding: '18px',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    boxShadow: 'var(--shadow-sm)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '14px'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <span className="badge" style={{ background: '#d1fae5', color: '#047857', fontWeight: 800, fontSize: '11px' }}>
                        🌐 Google Drive Album
                      </span>
                      <button
                        type="button"
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', opacity: 0.8 }}
                        onClick={() => confirmDeleteDriveLink(link._id)}
                        title="Delete Link"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>

                    <div style={{ fontSize: '16.5px', fontWeight: 850, color: 'var(--text)' }}>{link.title}</div>
                    {link.description && (
                      <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '4px', lineHeight: 1.4 }}>
                        {link.description}
                      </div>
                    )}
                    <div style={{ fontSize: '11.5px', color: 'var(--muted)', marginTop: '10px' }}>
                      Recorded by {link.createdBy?.name || 'Sweet Home'} • {formatDate(link.createdAt)}
                    </div>
                  </div>

                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn--primary"
                    style={{ width: '100%', justifyContent: 'center', gap: '6px', background: '#059669', borderColor: '#047857' }}
                  >
                    <ExternalLink size={16} /> Open Google Drive ↗
                  </a>
                </div>
              ))}
            </div>
          )
        ) : filteredPhotos.length === 0 ? (
          <EmptyState
            icon="🖼️"
            title={activeFolder === 'ALL' ? 'No memories added yet' : `No photos in "${activeFolder}"`}
            subtitle="Click 'Upload Photo' to add memories to this collection."
          />
        ) : (
          <div className="memory-photo-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '14px' }}>
            {filteredPhotos.map((p, idx) => (
              <motion.div
                key={p._id}
                initial={reduced ? { opacity: 1 } : { opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.25, delay: idx * 0.03 }}
                style={{
                  position: 'relative',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  boxShadow: 'var(--shadow-sm)',
                  cursor: 'pointer'
                }}
                onClick={() => setLightboxIndex(idx)}
              >
                <div style={{ aspectRatio: '4/3', width: '100%', overflow: 'hidden', position: 'relative', background: '#000' }}>
                  <img
                    src={p.src}
                    alt={p.name}
                    loading="lazy"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="%23818cf8" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>';
                    }}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s ease' }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 60%)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'flex-end',
                      padding: '12px'
                    }}
                  >
                    {p.caption && (
                      <div style={{ color: '#fff', fontSize: '13px', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {p.caption}
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px', fontSize: '11px', color: 'rgba(255,255,255,0.8)' }}>
                      <span>{p.uploadedBy?.name || 'Sweet Home'}</span>
                      <span>{formatDate(p.uploadedAt)}</span>
                    </div>
                  </div>
                  <span
                    style={{
                      position: 'absolute',
                      top: '10px',
                      left: '10px',
                      background: 'rgba(0,0,0,0.6)',
                      backdropFilter: 'blur(6px)',
                      color: '#fff',
                      fontSize: '10.5px',
                      fontWeight: 800,
                      padding: '3px 8px',
                      borderRadius: '8px'
                    }}
                  >
                    📁 {p.folder}
                  </span>

                  <button
                    type="button"
                    style={{
                      position: 'absolute',
                      top: '8px',
                      right: '8px',
                      background: 'rgba(239, 68, 68, 0.88)',
                      backdropFilter: 'blur(6px)',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '10px',
                      width: '30px',
                      height: '30px',
                      display: 'grid',
                      placeItems: 'center',
                      cursor: 'pointer',
                      boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
                      zIndex: 3
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget(p);
                    }}
                    title="Delete Photo"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      {/* Upload BottomSheet */}
      <BottomSheet open={showUpload} onClose={() => setShowUpload(false)} title="Upload Memory Photo" maxWidth={560}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Dropzone */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: '2px dashed var(--border)',
              borderRadius: '16px',
              padding: '24px',
              textAlign: 'center',
              cursor: 'pointer',
              background: previewUrl ? 'none' : 'var(--surface-2)',
              position: 'relative'
            }}
          >
            <input type="file" ref={fileInputRef} accept="image/*" style={{ display: 'none' }} onChange={handleFileSelect} />
            {previewUrl ? (
              <div style={{ position: 'relative', width: '100%', maxHeight: '260px', overflow: 'hidden', borderRadius: '12px' }}>
                <img src={previewUrl} alt="Preview" style={{ width: '100%', height: '240px', objectFit: 'cover', borderRadius: '12px' }} />
                <button
                  type="button"
                  style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.7)', color: '#fff', border: 'none', borderRadius: '50%', padding: '6px', cursor: 'pointer' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setPreviewUrl('');
                    setSelectedFile(null);
                  }}
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div>
                <Upload size={32} style={{ color: 'var(--accent)', marginBottom: '8px' }} />
                <div style={{ fontWeight: 800, fontSize: '15px' }}>Click or Drag &amp; Drop photo here</div>
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>JPEG, PNG, or WebP up to 12 MB</div>
              </div>
            )}
          </div>

          <label className="field-label">Target Folder</label>
          <select className="select" value={targetFolder} onChange={(e) => setTargetFolder(e.target.value)}>
            {folders.map((f) => (
              <option key={f.name} value={f.name}>
                📁 {f.name}
              </option>
            ))}
          </select>

          <label className="field-label">Caption / Description (Optional)</label>
          <input
            type="text"
            className="field__input"
            placeholder="e.g. Wayanad trip campfire night..."
            value={captionInput}
            onChange={(e) => setCaptionInput(e.target.value)}
          />

          <div className="sheet-actions">
            <button type="button" className="btn btn--ghost" onClick={() => setShowUpload(false)}>
              Cancel
            </button>
            <button type="button" className="btn btn--primary" disabled={!previewUrl || uploadBusy} onClick={savePhotoUpload}>
              {uploadBusy ? 'Uploading…' : 'Save Memory'}
            </button>
          </div>
        </div>
      </BottomSheet>

      {/* New Folder BottomSheet */}
      <BottomSheet open={showNewFolder} onClose={() => setShowNewFolder(false)} title="Create Memory Folder" maxWidth={480}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <label className="field-label">Folder Name</label>
          <input
            type="text"
            className="field__input"
            placeholder="e.g. Birthday 2026, Beach Outing..."
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
          />

          <label className="field-label">Folder Badge Color</label>
          <div style={{ display: 'flex', gap: '10px' }}>
            {FOLDER_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: c,
                  border: folderColor === c ? '3px solid var(--text)' : 'none',
                  cursor: 'pointer'
                }}
                onClick={() => setFolderColor(c)}
              />
            ))}
          </div>

          <label className="field-label">Description (Optional)</label>
          <input
            type="text"
            className="field__input"
            placeholder="e.g. Memories from our weekend trip..."
            value={folderDesc}
            onChange={(e) => setFolderDesc(e.target.value)}
          />

          <div className="sheet-actions">
            <button type="button" className="btn btn--ghost" onClick={() => setShowNewFolder(false)}>
              Cancel
            </button>
            <button type="button" className="btn btn--primary" disabled={!folderName.trim() || folderBusy} onClick={saveNewFolder}>
              {folderBusy ? 'Creating…' : 'Create Folder'}
            </button>
          </div>
        </div>
      </BottomSheet>

      {/* Google Drive Link BottomSheet */}
      <BottomSheet open={showDriveModal} onClose={() => setShowDriveModal(false)} title="Record Google Drive Photo Album" maxWidth={540}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p className="muted" style={{ fontSize: '13.5px', margin: 0 }}>
            Save links to external Google Drive photo folders, shared Google Photos albums, or cloud media folders.
          </p>

          <div>
            <label className="field-label">Album Title *</label>
            <input
              type="text"
              className="field__input"
              placeholder="e.g. Wayanad Trip 2026 Raw Photos"
              value={driveTitle}
              onChange={(e) => setDriveTitle(e.target.value)}
            />
          </div>

          <div>
            <label className="field-label">Google Drive / Google Photos Link *</label>
            <input
              type="url"
              className="field__input"
              placeholder="https://drive.google.com/drive/folders/..."
              value={driveUrl}
              onChange={(e) => setDriveUrl(e.target.value)}
            />
          </div>

          <div>
            <label className="field-label">Description (Optional)</label>
            <textarea
              className="field__input"
              rows={3}
              placeholder="Add details (e.g. HD videos, camera uploads, shared drive credentials...)"
              value={driveDesc}
              onChange={(e) => setDriveDesc(e.target.value)}
            />
          </div>

          <div className="sheet-actions">
            <button type="button" className="btn btn--ghost" onClick={() => setShowDriveModal(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn--primary"
              disabled={!driveTitle.trim() || !driveUrl.trim() || driveBusy}
              onClick={saveDriveLink}
              style={{ background: '#059669', borderColor: '#047857' }}
            >
              {driveBusy ? 'Saving…' : 'Save Drive Link'}
            </button>
          </div>
        </div>
      </BottomSheet>

      {/* Lightbox / Fullscreen Viewer */}
      {activeLightboxPhoto && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0,0,0,0.92)',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
          onClick={() => setLightboxIndex(-1)}
        >
          {/* Header controls */}
          <div
            style={{
              position: 'absolute',
              top: '16px',
              left: '20px',
              right: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              color: '#fff',
              zIndex: 2
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <div style={{ fontSize: '16px', fontWeight: 800 }}>{activeLightboxPhoto.caption || activeLightboxPhoto.name}</div>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>
                📁 {activeLightboxPhoto.folder} • Uploaded by {activeLightboxPhoto.uploadedBy?.name || 'Sweet Home'} on {formatDateTime(activeLightboxPhoto.uploadedAt)}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <a
                href={activeLightboxPhoto.src}
                download={activeLightboxPhoto.name || 'memory.jpg'}
                className="btn btn--ghost btn--sm"
                style={{ color: '#fff', background: 'rgba(255,255,255,0.15)' }}
              >
                <Download size={16} /> Download
              </a>

              <button
                type="button"
                className="btn btn--ghost btn--sm"
                style={{ color: '#ef4444', background: 'rgba(239,68,68,0.2)' }}
                onClick={() => setDeleteTarget(activeLightboxPhoto)}
              >
                <Trash2 size={16} /> Delete
              </button>

              <button
                type="button"
                style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: '50%', padding: '8px', cursor: 'pointer' }}
                onClick={() => setLightboxIndex(-1)}
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Navigation Arrows */}
          {filteredPhotos.length > 1 && (
            <>
              <button
                type="button"
                style={{
                  position: 'absolute',
                  left: '20px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'rgba(255,255,255,0.15)',
                  border: 'none',
                  color: '#fff',
                  borderRadius: '50%',
                  padding: '12px',
                  cursor: 'pointer'
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex((i) => (i - 1 + filteredPhotos.length) % filteredPhotos.length);
                }}
              >
                <ChevronLeft size={24} />
              </button>

              <button
                type="button"
                style={{
                  position: 'absolute',
                  right: '20px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'rgba(255,255,255,0.15)',
                  border: 'none',
                  color: '#fff',
                  borderRadius: '50%',
                  padding: '12px',
                  cursor: 'pointer'
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex((i) => (i + 1) % filteredPhotos.length);
                }}
              >
                <ChevronRight size={24} />
              </button>
            </>
          )}

          {/* Image (Uncropped Aspect Ratio) */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '60px 16px 20px'
            }}
          >
            <img
              src={activeLightboxPhoto.src}
              alt={activeLightboxPhoto.name}
              style={{
                maxHeight: 'calc(100vh - 120px)',
                maxWidth: 'calc(100vw - 120px)',
                objectFit: 'contain',
                borderRadius: '12px',
                boxShadow: '0 20px 40px rgba(0,0,0,0.7)',
                display: 'block'
              }}
            />
          </div>
        </div>
      )}

      {/* Confirm Photo Delete Modal */}
      <ConfirmModal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDeletePhoto}
        title="Delete Memory Photo"
        message="Are you sure you want to delete this memory photo from the cloud gallery? This cannot be undone."
        confirmLabel="Delete"
        danger
      />

      {/* Confirm Folder Delete Modal */}
      <ConfirmModal
        open={Boolean(deleteFolderTarget)}
        onClose={() => setDeleteFolderTarget(null)}
        onConfirm={confirmDeleteFolder}
        title={`Delete Folder "${deleteFolderTarget}"`}
        message="Deleting this folder will move all contained photos to the General folder. Proceed?"
        confirmLabel="Delete Folder"
        danger
      />
    </div>
  );
}
