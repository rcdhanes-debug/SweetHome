import { useRef, useState } from 'react';
import { Phone, Mail, Cake, Pencil, Camera, Check, Wallet } from 'lucide-react';
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
  const amount = payment?.amount || funding.contributionAmount;
  return payment?.paid ? `✓ Paid ${formatCurrency(amount)}` : `Due ${formatCurrency(amount)}`;
}

function myDuties(memberId, chores) {
  const map = {};
  (chores || []).forEach((d) => {
    if ((d.cooking || []).some((m) => String(m._id) === String(memberId))) map[d.day] = 'cooking';
    else if ((d.cleaning || []).some((m) => String(m._id) === String(memberId))) map[d.day] = 'cleaning';
    else if (d.homeClean && String(d.homeClean._id) === String(memberId)) map[d.day] = 'homeClean';
    else if ((d.resting || []).some((m) => String(m._id) === String(memberId))) map[d.day] = 'resting';
  });
  return DAY_ORDER.filter((day) => map[day]).map((day) => ({ day, role: map[day] }));
}

export default function Members() {
  const { users, funding, chores, loading, reloadUsers } = useApp();
  const { session, isAdmin, runWithAuth } = useAuth();
  const toast = useToast();

  const [selected, setSelected] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editAvatar, setEditAvatar] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [birthday, setBirthday] = useState('');
  const [upiId, setUpiId] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const meId = session?.user?._id;
  const isSelectedSelf = Boolean(selected && meId && String(selected._id) === String(meId));

  const openMember = (u) => {
    setSelected(u);
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
    if (!selected) return;
    setBusy(true);
    try {
      await runWithAuth(
        {
          title: 'Save Profile',
          subtitle: `Update ${selected.name}'s profile`,
          adminOnly: false,
          defaultName: session?.user?.name
        },
        async (token) => {
          await userApi.updateProfile(token, selected._id, { avatar: editAvatar, phone, email, birthday, upiId });
        }
      );
      toast.show('✓ Profile updated');
      setEditOpen(false);
      await reloadUsers();
      const refreshed = await userApi.listUsers();
      openMember(refreshed.find((u) => String(u._id) === String(selected._id)) || selected);
    } catch (err) {
      if (err.message !== 'Cancelled') toast.show(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const selectedPayment = paymentFor(funding, selected?._id);
  const selectedDuties = myDuties(selected?._id, chores);

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
        <div className="stack">
          <Skeleton height={120} />
          <Skeleton height={120} />
        </div>
      ) : users.length === 0 ? (
        <EmptyState icon="👥" title="No members" subtitle="Seed the database to get started." />
      ) : (
        <div className="member-grid">
          {users.map((u) => {
            const payment = paymentFor(funding, u._id);
            return (
              <button type="button" key={u._id} className="member-card" onClick={() => openMember(u)}>
                <Avatar user={u} name={u.name} size={56} />
                <div className="member-card__name">
                  {u.name}
                  {u.role === 'admin' && <span className="badge badge--admin">Admin</span>}
                  {u.away && <span className="badge badge--away">Away</span>}
                </div>
                <div className={`member-card__due ${payment?.paid ? 'is-paid' : ''}`}>
                  {dueLabel(funding, payment)}
                </div>
                {(u.phone || u.email) && (
                  <div className="member-card__contact">
                    {u.phone && <span>{u.phone}</span>}
                    {u.email && <span>{u.email}</span>}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      <BottomSheet
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.name || 'Profile'}
        maxWidth={520}
      >
        {selected && (
          <>
            <div className="profile-hero">
              <Avatar user={selected} name={selected.name} size={84} />
              <div className="profile-hero__info">
                <div className="profile-hero__name">
                  {selected.name}
                  {selected.role === 'admin' && <span className="badge badge--admin">Admin</span>}
                  {selected.away && <span className="badge badge--away">Away</span>}
                </div>
                <div className="profile-hero__meta">
                  {selected.phone && (
                    <a href={`tel:${selected.phone}`} className="chip">
                      <Phone size={13} /> {selected.phone}
                    </a>
                  )}
                  {selected.email && (
                    <a href={`mailto:${selected.email}`} className="chip">
                      <Mail size={13} /> {selected.email}
                    </a>
                  )}
                  {selected.birthday && (
                    <span className="chip">
                      <Cake size={13} /> {selected.birthday}
                    </span>
                  )}
                  {selected.upiId && (
                    <span className="chip">
                      <Wallet size={13} /> {selected.upiId}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="profile-summary">
              <div className="profile-summary__col">
                <span className="profile-summary__label">This month</span>
                <span className={`profile-summary__value ${selectedPayment?.paid ? 'is-paid' : ''}`}>
                  {selectedPayment?.paid
                    ? `✓ ${formatCurrency(selectedPayment.amount)} paid`
                    : `Due ${formatCurrency(selectedPayment?.amount || funding?.contributionAmount || 0)}`}
                </span>
                <span className="muted">{monthLabel(funding?.month)}</span>
              </div>
              <div className="profile-summary__col">
                <span className="profile-summary__label">Contribution</span>
                <span className="profile-summary__value">{funding ? formatCurrency(funding.contributionAmount) : '—'}</span>
                <span className="muted">per month per person</span>
              </div>
            </div>

            <div className="profile-block">
              <div className="profile-block__head">My chores this week</div>
              {loading.chores ? (
                <Skeleton height={60} />
              ) : selected.away ? (
                <p className="muted">Away — skipped in the chore rotation.</p>
              ) : selectedDuties.length === 0 ? (
                <p className="muted">No duties assigned this week.</p>
              ) : (
                <div className="duty-week">
                  {selectedDuties.map(({ day, role }) => (
                    <div key={day} className="duty-week__row">
                      <span className="duty-week__day">{day.slice(0, 3)}</span>
                      <span className="duty-week__role" style={{ color: DUTY_META[role].color }}>
                        {DUTY_META[role].icon} {DUTY_META[role].label}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {(isSelectedSelf || isAdmin) && (
              <div className="sheet-actions">
                <button type="button" className="btn btn--primary btn--block" onClick={() => setEditOpen(true)}>
                  <Pencil size={15} /> Edit Profile
                </button>
              </div>
            )}
          </>
        )}
      </BottomSheet>

      <BottomSheet open={editOpen} onClose={() => setEditOpen(false)} title={`Edit ${selected?.name}`} maxWidth={520}>
        {selected && (
          <>
            <div className="edit-avatar">
              <Avatar user={{ avatar: editAvatar }} name={selected.name} size={72} />
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
              <button type="button" className="btn btn--ghost" onClick={() => setEditOpen(false)}>
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
