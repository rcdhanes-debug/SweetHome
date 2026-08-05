import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Wallet, Users, TrendingUp, ChevronRight, Image as ImageIcon, Plus, Trash2, CalendarClock, CheckCircle2, QrCode, Copy, Smartphone, Pencil } from 'lucide-react';
import gsap from 'gsap';
import { useReducedMotion } from 'motion/react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import * as photoApi from '../services/photo';
import * as fundingApi from '../services/funding';
import { resolveMediaUrl } from '../services/api';
import ProgressBar from '../components/ProgressBar';
import CountUp from '../components/CountUp';
import Skeleton from '../components/Skeleton';
import DutyBlock from '../components/DutyBlock';
import CategoryIcon from '../components/CategoryIcon';
import EmptyState from '../components/EmptyState';
import BottomSheet from '../components/BottomSheet';
import ConfirmModal from '../components/ConfirmModal';
import Avatar from '../components/Avatar';
import { EVENT_META } from '../constants';
import { formatCurrency, formatDate, todayDayName, deadlineInfo, todayISTDateString } from '../utils/format';

export default function Dashboard() {
  const { funding, expenses, today, users, events, loading, reloadFunding } = useApp();
  const { isAdmin, runWithAuth } = useAuth();
  const toast = useToast();
  const reduced = useReducedMotion();

  const [photos, setPhotos] = useState([]);
  const [photosLoading, setPhotosLoading] = useState(true);
  const [viewer, setViewer] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [selectedName, setSelectedName] = useState('');
  const [photoBusy, setPhotoBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [qrModal, setQrModal] = useState(false);
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [editAccountOpen, setEditAccountOpen] = useState(false);
  const [editUpiInput, setEditUpiInput] = useState('');
  const [editQrImage, setEditQrImage] = useState(null);
  const [accountBusy, setAccountBusy] = useState(false);

  const fileRef = useRef(null);
  const qrFileRef = useRef(null);

  const commonUpi = funding?.commonAccount?.upiId || 'sweethome@okaxis';
  const commonQr = funding?.commonAccount?.qrImage || '/sweethome_upi_qr.png';

  const copyUpi = () => {
    navigator.clipboard.writeText(commonUpi);
    setCopiedUpi(true);
    toast.show('✓ Common UPI ID copied!');
    setTimeout(() => setCopiedUpi(false), 2000);
  };

  const openEditAccount = () => {
    setEditUpiInput(commonUpi);
    setEditQrImage(null);
    setEditAccountOpen(true);
  };

  const onPickQrFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.show('Only JPEG, PNG, or WebP images are allowed.', 'error');
      return;
    }
    if (file.size > 1 * 1024 * 1024) {
      toast.show('Image too large — max 1 MB.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setEditQrImage(reader.result);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const saveAccountSettings = async () => {
    const cleanUpi = editUpiInput.trim();
    const UPI_PATTERN = /^[^\s@]+@[a-zA-Z]{2,}$/;
    if (!cleanUpi || !UPI_PATTERN.test(cleanUpi)) {
      toast.show('Enter a valid UPI ID (e.g. name@okbank)', 'error');
      return;
    }
    setAccountBusy(true);
    try {
      await runWithAuth(
        { title: 'Update Common Account', subtitle: 'Admin PIN required', adminOnly: true },
        async (token) => {
          const payload = { upiId: cleanUpi };
          if (editQrImage) payload.qrImage = editQrImage;
          await fundingApi.updateCommonAccount(token, payload);
        }
      );
      toast.show('✓ Common account updated');
      setEditAccountOpen(false);
      await reloadFunding();
    } catch (err) {
      if (err.message !== 'Cancelled') toast.show(err.message, 'error');
    } finally {
      setAccountBusy(false);
    }
  };

  const loadPhotos = useCallback(async () => {
    try {
      setPhotos(await photoApi.listPhotos());
    } catch (_) {
      /* photos are decorative; keep gallery hidden on failure */
    } finally {
      setPhotosLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPhotos();
  }, [loadPhotos]);

  useEffect(() => {
    if (reduced || loading.funding) return undefined;
    const circles = document.querySelectorAll('.hero-deco__circle');
    const steps = [
      { x: -16, y: 12, duration: 9 },
      { x: 12, y: -9, duration: 7 },
      { x: -9, y: 7, duration: 11 }
    ];
    const tweens = Array.from(circles).map((el, i) =>
      gsap.to(el, {
        x: steps[i % steps.length].x,
        y: steps[i % steps.length].y,
        duration: steps[i % steps.length].duration,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1
      })
    );
    return () => tweens.forEach((t) => t.kill());
  }, [reduced, loading.funding]);

  const pct = funding ? Math.round((funding.totalCollected / funding.targetAmount) * 100) : 0;
  const recent = expenses.slice(0, 4);
  const deadline = deadlineInfo();
  const upcoming = events
    .filter((e) => e.date >= todayISTDateString())
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 3);
  const atHome = users.filter((u) => !u.away);
  const awayCount = users.length - atHome.length;

  const onPickPhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.show('Only JPEG, PNG, or WebP images are allowed.', 'error');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.show('Image too large — max 8 MB.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setSelectedPhoto(reader.result);
      setSelectedName(file.name);
      setAddOpen(true);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const doUploadPhoto = async () => {
    if (!selectedPhoto) return;
    setPhotoBusy(true);
    try {
      await photoApi.uploadPhoto(null, selectedPhoto, selectedName);
      toast.show('✓ Photo added');
      setAddOpen(false);
      setSelectedPhoto(null);
      setSelectedName('');
      await loadPhotos();
    } catch (err) {
      if (err.message !== 'Cancelled') toast.show(err.message, 'error');
    } finally {
      setPhotoBusy(false);
    }
  };

  const doDeletePhoto = async () => {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    try {
      await runWithAuth({ title: 'Remove Photo', subtitle: 'Admin PIN required', adminOnly: true }, async (token) => {
        await photoApi.deletePhoto(token, deleteTarget._id);
      });
      toast.show('Photo removed');
      setDeleteTarget(null);
      await loadPhotos();
    } catch (err) {
      if (err.message !== 'Cancelled') toast.show(err.message, 'error');
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div className="page">
      {loading.funding ? (
        <div className="stack">
          <Skeleton height={140} />
          <Skeleton height={120} />
          <Skeleton height={120} />
        </div>
      ) : (
        <div className="dashboard-grid">
          <section className="hero-card dash-hero">
            <div className="hero-card__top">
              <span className="hero-card__label">
                <span className="live-dot" /> AVAILABLE BALANCE
              </span>
              {isAdmin && <span className="badge badge--admin">Admin mode</span>}
            </div>
            <div className="hero-card__amount">
              <CountUp value={funding.balance} format={formatCurrency} duration={1100} />
            </div>

            {(funding.rolloverBalance > 0 || funding.isCustomRollover) && (
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(255, 255, 255, 0.14)',
                border: '1px solid rgba(255, 255, 255, 0.22)',
                padding: '4px 10px',
                borderRadius: '999px',
                fontSize: '12px',
                fontWeight: 700,
                color: '#fff',
                marginBottom: '4px',
                width: 'fit-content'
              }}>
                ✨ {formatCurrency(funding.rolloverBalance || 0)} carried over {funding.isCustomRollover ? '(Admin Set)' : 'from last month'}
              </div>
            )}

            <div className="hero-card__breakdown" style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-start' }}>
              <div>
                <span className="dot" style={{ background: '#f59e0b' }} />
                Rollover: <strong><CountUp value={funding.rolloverBalance || 0} format={formatCurrency} duration={1100} /></strong>
              </div>
              <div>
                <span className="dot dot--green" />
                Collected: <strong><CountUp value={funding.totalCollected} format={formatCurrency} duration={1100} /></strong>
              </div>
              <div>
                <span className="dot dot--red" />
                Spent: <strong><CountUp value={funding.totalSpent} format={formatCurrency} duration={1100} /></strong>
              </div>
            </div>
          </section>

          <section className="card dash-fund">
            <div className="card__head">
              <div>
                <h3>Monthly Fund</h3>
                <p className="muted">
                  <CountUp value={funding.totalCollected} format={formatCurrency} /> of <CountUp value={funding.targetAmount} format={formatCurrency} /> • <CountUp value={pct} format={(n) => `${Math.round(n)}%`} /> Collected
                </p>
              </div>
              <Link to="/collection" className="link-btn">
                Details <ArrowRight size={14} />
              </Link>
            </div>
            <ProgressBar value={funding.totalCollected} max={funding.targetAmount} />
            <div className="card__foot">
              <span className={deadline.passed ? 'text-danger' : ''}>{deadline.text}</span>
              <span>
                <CountUp value={funding.paidCount} />/{funding.paidCount + funding.pendingCount} paid
              </span>
            </div>
          </section>

          <section className="card dash-qr">
            <div className="card__head">
              <h3>
                <QrCode size={16} /> Common House Account
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="badge badge--today">Active</span>
                {isAdmin && (
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={openEditAccount}
                    title="Edit Common Account & QR Code"
                  >
                    <Pencil size={13} /> Edit
                  </button>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '8px' }}>
              <div
                onClick={() => setQrModal(true)}
                style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '14px',
                  overflow: 'hidden',
                  border: '1px solid var(--border)',
                  cursor: 'pointer',
                  flexShrink: 0,
                  background: '#000'
                }}
                title="Tap to view full QR code"
              >
                <img
                  src={resolveMediaUrl(commonQr)}
                  alt="Sweet Home UPI QR Code"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  UPI ID (Common Account)
                </div>
                <div className="redeem-upi" style={{ fontSize: '15px', fontWeight: 800, margin: '2px 0 8px' }}>
                  {commonUpi}
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn--ghost btn--sm" onClick={copyUpi}>
                    <Copy size={13} /> {copiedUpi ? 'Copied!' : 'Copy UPI'}
                  </button>
                  <a
                    href={`upi://pay?pa=${commonUpi}&pn=Sweet%20Home%20Fund&cu=INR`}
                    className="btn btn--primary btn--sm"
                    style={{ textDecoration: 'none', gap: '4px' }}
                  >
                    <Smartphone size={13} /> Pay via App
                  </a>
                </div>
              </div>
            </div>
          </section>

          <section className="card card--tint floaty floaty--1 dash-contrib">
              <div className="card__head">
                <h3>Contribution</h3>
                <Users size={18} className="muted-icon" />
              </div>
              <div className="big-number">
                <CountUp value={funding.paidCount} />/{funding.paidCount + funding.pendingCount}
              </div>
              <p className="muted">
                <CountUp value={funding.pendingCount} /> pending • ₹{funding.contributionAmount.toLocaleString('en-IN')} each
              </p>
              <Link to="/collection" className="link-btn">
                View payments <ChevronRight size={14} />
              </Link>
            </section>

            <section className="card card--tint floaty floaty--2 dash-expenses">
              <div className="card__head">
                <h3>Expenses</h3>
                <TrendingUp size={18} className="muted-icon" />
              </div>
              <div className="big-number">
                <CountUp value={funding.totalSpent} format={formatCurrency} />
              </div>
              <p className="muted">spent this month</p>
              <Link to="/expenses" className="link-btn">
                View ledger <ChevronRight size={14} />
              </Link>
            </section>

          <section className="card dash-duties">
            <div className="card__head">
              <h3>
                Today's Duties <span className="badge badge--today">{todayDayName()}</span>
              </h3>
              <Link to="/chores" className="link-btn">
                Schedule <ArrowRight size={14} />
              </Link>
            </div>
            {loading.chores || !today ? (
              <Skeleton height={120} />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
                <DutyBlock role="cooking" members={today.cooking} />
                <DutyBlock role="cleaning" members={today.cleaning} />
                <DutyBlock role="homeClean" members={today.homeClean ? [today.homeClean] : []} />
              </div>
            )}
          </section>

          <section className="card dash-recent">
            <div className="card__head">
              <h3>Recent Expenses</h3>
              <Link to="/expenses" className="link-btn">
                All <ArrowRight size={14} />
              </Link>
            </div>
            {loading.expenses ? (
              <div className="stack">
                <Skeleton height={52} />
                <Skeleton height={52} />
              </div>
            ) : recent.length === 0 ? (
              <EmptyState icon="🧾" title="No expenses yet" subtitle="Add the first expense of the month." />
            ) : (
              <div className="mini-ledger">
                {recent.map((e) => (
                  <div key={e._id} className="mini-ledger__row">
                    <CategoryIcon category={e.category} size={16} />
                    <div className="mini-ledger__body">
                      <div className="mini-ledger__cat">{e.category}</div>
                      <div className="mini-ledger__meta">
                        {e.paidBy?.name} • {formatDate(e.expenseDate)}
                      </div>
                    </div>
                    <div className="mini-ledger__amt">{formatCurrency(e.amount)}</div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="card dash-upcoming">
            <div className="card__head">
              <h3>
                <CalendarClock size={16} /> Upcoming
              </h3>
              <Link to="/calendar" className="link-btn">
                Calendar <ArrowRight size={14} />
              </Link>
            </div>
            {loading.events ? (
              <Skeleton height={70} />
            ) : upcoming.length === 0 ? (
              <EmptyState icon="🗓️" title="Nothing scheduled" subtitle="Add events in the Calendar." />
            ) : (
              <div className="mini-events">
                {upcoming.map((e) => (
                  <Link key={e._id} to="/calendar" className="mini-event">
                    <span className="mini-event__icon" style={{ color: EVENT_META[e.type]?.color }}>
                      {EVENT_META[e.type]?.icon}
                    </span>
                    <div className="mini-event__body">
                      <div className="mini-event__title">{e.title}</div>
                      <div className="mini-event__date">{e.date}</div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="card dash-photos">
            <div className="card__head">
              <h3>
                <ImageIcon size={16} /> Our Memories
              </h3>
              <button type="button" className="btn btn--primary btn--sm" onClick={() => fileRef.current?.click()}>
                <Plus size={15} /> Add Photo
              </button>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="visually-hidden"
              onChange={onPickPhoto}
            />
            {photosLoading ? (
              <Skeleton height={110} />
            ) : photos.length === 0 ? (
              <EmptyState icon="🖼️" title="No memories yet" subtitle='Tap "Add Photo" to start the gallery.' />
            ) : (
              <div className="photo-grid">
                {photos.map((p) => (
                  <div key={p._id} className="photo-tile" onClick={() => setViewer(p)}>
                    <img src={resolveMediaUrl(p.src)} alt={p.name || 'Memory'} loading="lazy" />
                    {isAdmin && (
                      <button
                        type="button"
                        className="photo-tile__del"
                        aria-label="Remove photo"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget(p);
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                    {p.name && <span className="photo-tile__name">{p.name}</span>}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      <BottomSheet open={Boolean(viewer)} onClose={() => setViewer(null)} title={viewer?.name || 'Memory'}>
        <div className="photo-viewer">
          <img src={resolveMediaUrl(viewer?.src)} alt={viewer?.name || 'Memory'} />
        </div>
        {viewer && (
          <p className="muted sheet-subtitle">Added {formatDate(viewer.uploadedAt)}</p>
        )}
      </BottomSheet>

      <BottomSheet open={addOpen} onClose={() => setAddOpen(false)} title="Add Photo">
        {selectedPhoto && (
          <div className="photo-viewer">
            <img src={selectedPhoto} alt="Preview" />
          </div>
        )}
        <label className="field-label">Name (optional)</label>
        <input
          className="text-input"
          value={selectedName}
          onChange={(e) => setSelectedName(e.target.value)}
          placeholder="e.g. Housewarming dinner"
          maxLength={120}
        />
        <div className="sheet-actions">
          <button type="button" className="btn btn--ghost" onClick={() => setAddOpen(false)}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary" disabled={photoBusy} onClick={doUploadPhoto}>
            {photoBusy ? 'Uploading…' : 'Upload Photo'}
          </button>
        </div>
      </BottomSheet>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={doDeletePhoto}
        loading={deleteBusy}
        title="Remove Photo"
        message={`Remove ${deleteTarget?.name ? `"${deleteTarget.name}"` : 'this photo'} from the gallery?`}
        confirmLabel="Remove"
        danger
      />

      <BottomSheet open={qrModal} onClose={() => setQrModal(false)} title="Sweet Home Common Account QR">
        <div style={{ textAlign: 'center', padding: '10px 0' }}>
          <img
            src={resolveMediaUrl(commonQr)}
            alt="Sweet Home Common Account QR"
            style={{ maxWidth: '280px', width: '100%', height: 'auto', borderRadius: '16px', border: '1px solid var(--border)' }}
          />
          <div className="redeem-upi" style={{ fontSize: '18px', fontWeight: 800, margin: '14px 0 8px' }}>
            {commonUpi}
          </div>
          <p className="muted" style={{ fontSize: '13px', margin: '0 0 16px' }}>
            Scan using GPay, PhonePe, Paytm, or any UPI app to transfer funds directly to the house account.
          </p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button type="button" className="btn btn--ghost" onClick={copyUpi}>
              <Copy size={15} /> {copiedUpi ? 'Copied!' : 'Copy UPI ID'}
            </button>
            <a
              href={`upi://pay?pa=${commonUpi}&pn=Sweet%20Home%20Fund&cu=INR`}
              className="btn btn--primary"
              style={{ textDecoration: 'none' }}
            >
              <Smartphone size={15} /> Open UPI App
            </a>
          </div>
        </div>
      </BottomSheet>

      <BottomSheet open={editAccountOpen} onClose={() => setEditAccountOpen(false)} title="Edit Common Account">
        <p className="sheet-subtitle">Update pre-stored UPI ID & QR Code for the house common account.</p>
        <label className="field-label">UPI ID</label>
        <input
          className="text-input"
          type="text"
          value={editUpiInput}
          onChange={(e) => setEditUpiInput(e.target.value)}
          placeholder="e.g. sweethome@okaxis"
        />

        <label className="field-label" style={{ marginTop: '14px' }}>QR Code Image</label>
        <input
          ref={qrFileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="visually-hidden"
          onChange={onPickQrFile}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '6px' }}>
          <img
            src={resolveMediaUrl(editQrImage || commonQr)}
            alt="QR Code Preview"
            style={{ width: '80px', height: '80px', borderRadius: '12px', border: '1px solid var(--border)', objectFit: 'cover' }}
          />
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => qrFileRef.current?.click()}
          >
            Upload New QR Image
          </button>
        </div>

        <div className="sheet-actions" style={{ marginTop: '20px' }}>
          <button type="button" className="btn btn--ghost" onClick={() => setEditAccountOpen(false)}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary" disabled={accountBusy} onClick={saveAccountSettings}>
            {accountBusy ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
