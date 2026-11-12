import { useRef, useState } from 'react';
import { Phone, Mail, Cake, Pencil, Camera, Check, Wallet, ShieldCheck } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import * as userApi from '../services/users';
import Avatar from '../components/Avatar';
import BottomSheet from '../components/BottomSheet';
import Skeleton from '../components/Skeleton';
import EmptyState from '../components/EmptyState';
import { DUTY_META } from '../constants';
import { formatCurrency, monthLabel } from '../utils/format';

const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function compressImage(file, maxDim = 256, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('Could not read image'));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

function paymentFor(funding, memberId) {
  return funding?.payments?.find((p) => p.user && String(p.user._id) === String(memberId));
}

function dueLabel(funding, payment) {
  if (!funding) return '—';
  if (!payment) return 'Not in cycle';
  const amount = payment.amount || funding.contributionAmount;
  if (payment.paid) return `✓ Paid ${formatCurrency(amount)}`;
  if (payment.status === 'partial') return `Due ${formatCurrency(payment.dueAmount)}`;
  return `Due ${formatCurrency(funding.contributionAmount)}`;
}

function myDuties(memberId, chores) {
  const map = {};
  (chores || []).forEach((d) => {
    if ((d.cooking || []).some((m) => String(m._id) === String(memberId))) map[d.day] = 'cooking';
    else if ((d.cleaning || []).some((m) => String(m._id) === String(memberId))) map[d.day] = 'cleaning';
    else if (d.homeClean && String(d.homeClean._id) === String(memberId)) map[d.day] = 'homeClean';
  });
  return DAY_ORDER.filter((day) => map[day]).map((day) => ({ day, role: map[day] }));
}

export default function Members() {
  const { users, funding, chores, loading, reloadUsers } = useApp();
  const { session, isAdmin, runWithAuth } = useAuth();
  const toast = useToast();

  const [editTarget, setEditTarget] = useState(null);
  const [editAvatar, setEditAvatar] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [birthday, setBirthday] = useState('');
  const [upiId, setUpiId] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const meId = session?.user?._id;

  const openEdit = (u) => {
    setEditTarget(u);
    setEditAvatar(u.avatar || '');
    setPhone(u.phone || '');
    setEmail(u.email || '');
    setBirthday(u.birthday || '');
    setUpiId(u.upiId || '');
  };

  const onPickAvatar = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.show('Only JPEG, PNG, or WebP images are allowed.', 'error');
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      toast.show('Image too large — max 6 MB.', 'error');
      return;
    }
    try {
      setEditAvatar(await compressImage(file));
    } catch (err) {
      toast.show(err.message, 'error');
    }
  };

  const doSaveProfile = async () => {
    if (!editTarget) return;
    setBusy(true);
    try {
      await runWithAuth(
        {
          title: 'Save Profile',
          subtitle: `Update ${editTarget.name}'s profile`,
          adminOnly: false,
          defaultName: isAdmin ? session?.user?.name : editTarget.name
        },
        async (token) => {
          await userApi.updateProfile(token, editTarget._id, { avatar: editAvatar, phone, email, birthday, upiId });
        }
      );
      toast.show('✓ Profile updated');
      setEditTarget(null);
      await reloadUsers();
    } catch (err) {
      if (err.message !== 'Cancelled') toast.show(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h2>Members</h2>
          <p className="muted">
            {users.filter((u) => !u.away).length} at home • {users.filter((u) => u.away).length} away
          </p>
        </div>
      </div>

      {loading.users ? (
        <div className="member-profile-grid">
          <Skeleton height={210} />
          <Skeleton height={210} />
          <Skeleton height={210} />
        </div>
      ) : users.length === 0 ? (
        <EmptyState icon="👥" title="No members" subtitle="Seed the database to get started." />
      ) : (
        <div className="member-profile-grid">
          {users.map((u) => {
            const payment = paymentFor(funding, u._id);
            const duties = myDuties(u._id, chores);
            const isPaid = Boolean(payment?.paid);
            const isSelf = Boolean(meId && String(u._id) === String(meId));

            return (
              <article key={u._id} className="member-profile-card">
                <div className="member-profile-card__head">
                  <div className="member-profile-card__identity">
                    <Avatar user={u} name={u.name} size={52} />
                    <div className="member-profile-card__title-wrap">
                      <div className="member-profile-card__name-row">
                        <span className="member-profile-card__name">{u.name}</span>
                        {u.role === 'admin' && (
                          <span className="badge badge--admin">
                            <ShieldCheck size={10} /> Admin
                          </span>
                        )}
                        {u.away && <span className="badge badge--away">Away</span>}
                        {isSelf && <span className="badge badge--today">You</span>}
                      </div>
                      <span className="member-profile-card__role">
                        {u.role === 'admin' ? 'House Admin' : 'Housemate'}
                        {funding?.month ? ` • ${monthLabel(funding.month)}` : ''}
                      </span>
                    </div>
                  </div>

                  <span className={`member-profile-card__status ${isPaid ? 'is-paid' : payment ? 'is-due' : ''}`}>
                    {dueLabel(funding, payment)}
                  </span>
                </div>

                {(u.upiId || u.phone || u.email || u.birthday) && (
                  <div className="member-profile-card__meta">
                    {u.upiId && (
                      <span className="chip member-profile-chip" title={u.upiId}>
                        <Wallet size={12} /> {u.upiId}
                      </span>
                    )}
                    {u.phone && (
                      <a href={`tel:${u.phone}`} className="chip member-profile-chip">
                        <Phone size={12} /> {u.phone}
                      </a>
                    )}
                    {u.email && (
                      <a href={`mailto:${u.email}`} className="chip member-profile-chip" title={u.email}>
                        <Mail size={12} /> {u.email}
                      </a>
                    )}
                    {u.birthday && (
                      <span className="chip member-profile-chip">
                        <Cake size={12} /> {u.birthday}
                      </span>
                    )}
                  </div>
                )}

                <div className="member-profile-card__duties">
                  <div className="member-profile-card__section-label">This week&apos;s duties</div>
                  {loading.chores ? (
                    <Skeleton height={28} />
                  ) : u.away ? (
                    <p className="member-profile-card__empty">Away — skipped in chore rotation</p>
                  ) : duties.length === 0 ? (
                    <p className="member-profile-card__empty">No active duties assigned</p>
                  ) : (
                    <div className="member-duty-pills">
                      {duties.map(({ day, role }) => {
                        const meta = DUTY_META[role];
                        return (
                          <span
                            key={day}
                            className="member-duty-pill"
                            style={{
                              color: meta.color,
                              background: meta.bg,
                              borderColor: meta.border
                            }}
                          >
                            <strong>{day.slice(0, 3)}</strong> {meta.icon} {meta.label}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="member-profile-card__foot">
                  <span className="member-profile-card__contrib">
                    Monthly share: {funding ? formatCurrency(funding.contributionAmount) : '—'}
                  </span>
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => openEdit(u)}>
                    <Pencil size={13} /> Edit Profile
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <BottomSheet open={Boolean(editTarget)} onClose={() => setEditTarget(null)} title={`Edit ${editTarget?.name}`} maxWidth={520}>
        {editTarget && (
          <>
            <div className="edit-avatar">
              <Avatar user={{ avatar: editAvatar }} name={editTarget.name} size={72} />
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => fileRef.current?.click()}>
                <Camera size={14} /> Change photo
              </button>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="visually-hidden" onChange={onPickAvatar} />
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => setEditAvatar('')}>
                <Check size={14} /> Remove photo
              </button>
            </div>
            <label className="field-label">Phone</label>
            <input className="text-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 …" maxLength={15} />
            <label className="field-label">Email</label>
            <input className="text-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" maxLength={120} />
            <label className="field-label">Pre-stored UPI ID</label>
            <input className="text-input" value={upiId} onChange={(e) => setUpiId(e.target.value)} placeholder="e.g. name@okbank" maxLength={120} />
            <label className="field-label">Birthday</label>
            <input
              className="text-input"
              value={birthday}
              onChange={(e) => setBirthday(e.target.value)}
              placeholder="MM-DD — e.g. 05-14"
              maxLength={5}
            />
            <p className="muted card__hint">The birthday shows automatically on the calendar each year.</p>
            <div className="sheet-actions">
              <button type="button" className="btn btn--ghost" onClick={() => setEditTarget(null)}>
                Cancel
              </button>
              <button type="button" className="btn btn--primary" disabled={busy} onClick={doSaveProfile}>
                {busy ? 'Saving…' : 'Save Profile'}
              </button>
            </div>
          </>
        )}
      </BottomSheet>
    </div>
  );
}
