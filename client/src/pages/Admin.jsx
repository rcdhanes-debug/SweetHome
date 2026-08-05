import { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, Lock, UserCog, History, KeyRound, Wallet, Receipt, CalendarDays, CreditCard, Pencil, ChevronLeft, ChevronRight, Send } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import * as userApi from '../services/users';
import * as adminApi from '../services/admin';
import BottomSheet from '../components/BottomSheet';
import ConfirmModal from '../components/ConfirmModal';
import Avatar from '../components/Avatar';
import Skeleton from '../components/Skeleton';
import EmptyState from '../components/EmptyState';
import { formatDateTime, formatCurrency, monthLabel } from '../utils/format';
import { AUDIT_LABELS, ADMINS, DEFAULT_UPI_IDS } from '../constants';

function remaining(expiresAt) {
  const ms = Math.max(0, expiresAt - Date.now());
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}m ${s}s`;
}

function auditDetail(l) {
  const d = l.details || {};
  if (l.action === 'CHORE_SWAP' && d.aName && d.bName) {
    return `${d.aName}: ${d.aRole} → ${d.bRole} • ${d.bName}: ${d.bRole} → ${d.aRole} (${d.day})`;
  }
  if (l.action === 'CHORE_UPDATED' && d.day) return `${d.day} updated`;
  if (l.action === 'EXPENSE_CREATED' && d.amount) return `${l.targetUser?.name ? l.targetUser.name + ' · ' : ''}₹${d.amount} — ${d.category}`;
  if (l.action === 'EXPENSE_DELETED' && d.amount) return `₹${d.amount} — ${d.category}`;
  if (l.action === 'PIN_CHANGED' && d.name) return `${d.name}`;
  return '';
}

export default function Admin() {
  const { session, isAdmin, adminUser, runWithAuth, requestIdentity, logout } = useAuth();
  const { users, history, reloadUsers, reloadFunding } = useApp();
  const toast = useToast();
  const navigate = useNavigate();

  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [pinTarget, setPinTarget] = useState(null);
  const [newPin, setNewPin] = useState('');
  const [pinBusy, setPinBusy] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [roleTarget, setRoleTarget] = useState(null);
  const [roleBusy, setRoleBusy] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [upiTarget, setUpiTarget] = useState(null);
  const [newUpi, setNewUpi] = useState('');
  const [upiBusy, setUpiBusy] = useState(false);
  const [logsPage, setLogsPage] = useState(0);
  const PAGE_SIZE = 10;

  const [telegramConfig, setTelegramConfig] = useState({ token: '8826854405:AAEiAp1cYzpSWhH5xcuxSnoAUv64JA5tWIY', chatId: '', enabled: true });
  const [tgLoading, setTgLoading] = useState(false);
  const [tgSaving, setTgSaving] = useState(false);
  const [tgTesting, setTgTesting] = useState(false);
  const [tgChoresTesting, setTgChoresTesting] = useState(false);
  const [tgBalanceTesting, setTgBalanceTesting] = useState(false);

  const loadLogs = useCallback(async () => {
    if (!isAdmin) return;
    setLogsLoading(true);
    try {
      await runWithAuth({ adminOnly: true }, async (token) => {
        setLogs(await adminApi.auditLogs(token));
        setLogsPage(0);
      });
    } catch (err) {
      toast.show(err.message, 'error');
    } finally {
      setLogsLoading(false);
    }
  }, [isAdmin, runWithAuth, toast]);

  const loadTelegram = useCallback(async () => {
    if (!isAdmin) return;
    setTgLoading(true);
    try {
      await runWithAuth({ adminOnly: true }, async (token) => {
        const res = await adminApi.getTelegramConfig(token);
        if (res?.data) setTelegramConfig(res.data);
      });
    } catch (_) {
    } finally {
      setTgLoading(false);
    }
  }, [isAdmin, runWithAuth]);

  useEffect(() => {
    if (isAdmin) {
      loadLogs();
      loadTelegram();
    }
  }, [isAdmin, loadLogs, loadTelegram]);

  const saveTelegram = async () => {
    setTgSaving(true);
    try {
      await runWithAuth({ title: 'Save Telegram Settings', adminOnly: true }, async (token) => {
        const res = await adminApi.updateTelegramConfig(token, telegramConfig);
        if (res?.data) setTelegramConfig(res.data);
      });
      toast.show('✓ Telegram configuration saved!');
    } catch (err) {
      if (err.message !== 'Cancelled') toast.show(err.message, 'error');
    } finally {
      setTgSaving(false);
    }
  };

  const testTelegram = async () => {
    setTgTesting(true);
    try {
      await runWithAuth({ title: 'Send Telegram Test', adminOnly: true }, async (token) => {
        await adminApi.sendTelegramTest(token, telegramConfig);
      });
      toast.show('🚀 Telegram test message sent successfully!');
    } catch (err) {
      if (err.message !== 'Cancelled') toast.show(`Test failed: ${err.message}`, 'error');
    } finally {
      setTgTesting(false);
    }
  };

  const testChoresTelegram = async () => {
    setTgChoresTesting(true);
    try {
      await runWithAuth({ title: "Send Tomorrow's Chores Alert", adminOnly: true }, async (token) => {
        const res = await adminApi.sendTomorrowChoresTest(token);
        if (res?.data?.ok) toast.show("🧹 Tomorrow's duty schedule sent to Telegram!");
        else toast.show("Failed to send chores notification", 'error');
      });
    } catch (err) {
      if (err.message !== 'Cancelled') toast.show(`Alert failed: ${err.message}`, 'error');
    } finally {
      setTgChoresTesting(false);
    }
  };

  const testBalanceTelegram = async () => {
    setTgBalanceTesting(true);
    try {
      await runWithAuth({ title: 'Send Remaining Money Alert', adminOnly: true }, async (token) => {
        const res = await adminApi.sendRemainingMoneyTest(token);
        if (res?.data?.ok) toast.show('💰 Remaining balance update sent to Telegram!');
        else toast.show('Failed to send balance update', 'error');
      });
    } catch (err) {
      if (err.message !== 'Cancelled') toast.show(`Alert failed: ${err.message}`, 'error');
    } finally {
      setTgBalanceTesting(false);
    }
  };

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const enterAdminMode = async () => {
    try {
      await requestIdentity({ title: 'Enter Admin Mode', subtitle: 'Select an admin account and enter your PIN', adminOnly: true });
      toast.show('🛡 Admin mode unlocked');
      loadLogs();
    } catch (err) {
      if (err.message !== 'Cancelled') toast.show(err.message, 'error');
    }
  };

  const confirmPinChange = async () => {
    if (!/^\d{4}$/.test(newPin)) {
      toast.show('PIN must be exactly 4 digits.', 'error');
      return;
    }
    setPinBusy(true);
    try {
      await runWithAuth({ title: 'Change PIN', subtitle: `Reset PIN for ${pinTarget?.name}`, adminOnly: true }, async (token) => {
        await userApi.changeUserPin(token, pinTarget._id, newPin);
      });
      toast.show(`✓ PIN updated for ${pinTarget.name}`);
      setPinTarget(null);
      setNewPin('');
    } catch (err) {
      if (err.message !== 'Cancelled') toast.show(err.message, 'error');
    } finally {
      setPinBusy(false);
    }
  };

  const confirmRoleChange = async () => {
    const target = roleTarget;
    setRoleBusy(true);
    try {
      const newRole = target.role === 'admin' ? 'member' : 'admin';
      await runWithAuth(
        { title: 'Change Admin Access', subtitle: `${target.name} → ${newRole === 'admin' ? 'Admin' : 'Member'}`, adminOnly: true },
        async (token) => {
          await userApi.updateUser(token, target._id, newRole);
        }
      );
      toast.show(newRole === 'admin' ? `✓ ${target.name} is now an admin` : `${target.name} is no longer an admin`);
      setRoleTarget(null);
      await reloadUsers();
    } catch (err) {
      if (err.message !== 'Cancelled') toast.show(err.message, 'error');
    } finally {
      setRoleBusy(false);
    }
  };

  const confirmUpiChange = async () => {
    const clean = newUpi.trim();
    const UPI_PATTERN = /^[^\s@]+@[a-zA-Z]{2,}$/;
    if (!clean || !UPI_PATTERN.test(clean)) {
      toast.show('Enter a valid UPI ID (e.g. name@okbank)', 'error');
      return;
    }
    setUpiBusy(true);
    try {
      await runWithAuth(
        { title: 'Update UPI ID', subtitle: `${upiTarget.name} → ${clean}`, adminOnly: true },
        async (token) => {
          await userApi.updateProfile(token, upiTarget._id, { upiId: clean });
        }
      );
      toast.show(`✓ UPI ID updated for ${upiTarget.name}`);
      setUpiTarget(null);
      setNewUpi('');
      await reloadUsers();
    } catch (err) {
      if (err.message !== 'Cancelled') toast.show(err.message, 'error');
    } finally {
      setUpiBusy(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="page">
        <section className="lock-card">
          <div className="lock-card__icon">
            <ShieldCheck size={40} />
          </div>
          <h2>Admin Mode</h2>
          <p className="muted">Admins can unlock administrative controls.</p>
          <button type="button" className="btn btn--primary btn--lg" onClick={enterAdminMode}>
            Enter Admin Mode
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="page">
      <section className="admin-session">
        <div className="admin-session__badge">
          <ShieldCheck size={22} />
        </div>
        <div className="admin-session__info">
          <div className="admin-session__name">Logged in as {adminUser?.name}</div>
          <div className="admin-session__expiry">Session expires in {remaining(session?.expiresAt || 0)}</div>
        </div>
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => setConfirmLogout(true)}>
          <Lock size={14} /> Lock
        </button>
      </section>

      <div className="grid-3">
        <button type="button" className="admin-tile" onClick={() => navigate('/collection')}>
          <Wallet size={20} /> Funding
        </button>
        <button type="button" className="admin-tile" onClick={() => navigate('/expenses')}>
          <Receipt size={20} /> Expenses
        </button>
        <button type="button" className="admin-tile" onClick={() => navigate('/chores')}>
          <CalendarDays size={20} /> Chores
        </button>
      </div>

      <div className="chip-row" style={{ marginTop: '6px' }}>
        <button
          type="button"
          className={`chip ${activeTab === 'all' ? 'chip--active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          All Controls
        </button>
        <button
          type="button"
          className={`chip ${activeTab === 'users' ? 'chip--active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          <UserCog size={13} /> Users
        </button>
        <button
          type="button"
          className={`chip ${activeTab === 'upi' ? 'chip--active' : ''}`}
          onClick={() => setActiveTab('upi')}
        >
          <CreditCard size={13} /> UPI List
        </button>
        <button
          type="button"
          className={`chip ${activeTab === 'history' ? 'chip--active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          <History size={13} /> Monthly History
        </button>
        <button
          type="button"
          className={`chip ${activeTab === 'logs' ? 'chip--active' : ''}`}
          onClick={() => setActiveTab('logs')}
        >
          <History size={13} /> Activity Logs
        </button>
        <button
          type="button"
          className={`chip ${activeTab === 'telegram' ? 'chip--active' : ''}`}
          onClick={() => setActiveTab('telegram')}
        >
          <Send size={13} /> Telegram Bot
        </button>
      </div>

      {(activeTab === 'all' || activeTab === 'users') && (
        <section className="card">
          <div className="card__head">
            <h3>
              <UserCog size={16} /> User Management
            </h3>
          </div>
          <p className="muted card__hint">Protected admins ({ADMINS.join(', ')}) can never be demoted.</p>
          <div className="user-list">
            {users.map((u) => (
              <div key={u._id} className="user-row">
                <Avatar name={u.name} />
                <div className="user-row__info">
                  <div className="user-row__name">
                    {u.name}
                    {u.role === 'admin' && <span className="badge badge--admin">Admin</span>}
                    {ADMINS.includes(u.name) && <span className="badge badge--protected">Protected</span>}
                  </div>
                  <div className="user-row__role">{u.role}</div>
                </div>
                {ADMINS.includes(u.name) ? (
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm btn--disabled"
                    disabled
                    title="Protected admin — access cannot be changed"
                  >
                    <ShieldCheck size={14} /> Protected
                  </button>
                ) : u.role === 'admin' ? (
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={() => setRoleTarget(u)}
                    title="Remove admin access"
                  >
                    <ShieldCheck size={14} /> Admin
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn--primary btn--sm"
                    onClick={() => setRoleTarget(u)}
                    title="Grant admin access"
                  >
                    <UserCog size={14} /> Make Admin
                  </button>
                )}
                <button type="button" className="icon-btn" onClick={() => { setPinTarget(u); setNewPin(''); }} title="Reset PIN">
                  <KeyRound size={16} />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {(activeTab === 'all' || activeTab === 'upi') && (
        <section className="card">
          <div className="card__head">
            <h3>
              <CreditCard size={16} /> UPI Handle Directory
            </h3>
          </div>
          <p className="muted card__hint">
            Manage housemates' pre-stored UPI handles used for payments and redeem requests.
          </p>
          <div className="user-list">
            {users.map((u) => {
              const handle = u.upiId || DEFAULT_UPI_IDS[u.name] || `${u.name.toLowerCase()}@okaxis`;
              return (
                <div key={u._id} className="user-row">
                  <Avatar name={u.name} />
                  <div className="user-row__info">
                    <div className="user-row__name">{u.name}</div>
                    <div className="redeem-upi" style={{ fontSize: '13px', marginTop: '2px' }}>
                      {handle}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={() => {
                      setUpiTarget(u);
                      setNewUpi(handle);
                    }}
                    title="Edit UPI ID"
                  >
                    <Pencil size={13} /> Edit UPI
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {(activeTab === 'all' || activeTab === 'history') && (
        <section className="card">
          <div className="card__head">
            <h3>
              <History size={16} /> Monthly History
            </h3>
          </div>
          <div className="history-list">
            {history.map((h) => (
              <div key={h.month} className="history-row">
                <div>
                  <div className="history-row__month">{monthLabel(h.month)}</div>
                  <div className="history-row__sub">
                    {h.paidCount}/{h.paidCount + h.pendingCount} paid
                  </div>
                </div>
                <div className="history-row__amt">{formatCurrency(h.totalCollected)}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {(activeTab === 'all' || activeTab === 'logs') && (
        <section className="card">
          <div className="card__head">
            <h3>
              <History size={16} /> Activity History
            </h3>
            <button type="button" className="link-btn" onClick={loadLogs}>
              Refresh
            </button>
          </div>
          {logsLoading && logs.length === 0 ? (
            <div className="stack">
              <Skeleton height={52} />
              <Skeleton height={52} />
            </div>
          ) : logs.length === 0 ? (
            <EmptyState icon="🕘" title="No activity yet" subtitle="Actions like payments and swaps will appear here." />
          ) : (
            <>
              <div className="audit-list">
                {logs
                  .slice(logsPage * PAGE_SIZE, (logsPage + 1) * PAGE_SIZE)
                  .map((l) => (
                    <div key={l._id} className="audit-row">
                      <span className="audit-dot" />
                      <div className="audit-row__body">
                        <div className="audit-row__action">{AUDIT_LABELS[l.action] || l.action}</div>
                        <div className="audit-row__meta">
                          {l.performedBy ? l.performedBy.name : 'System'}
                          {l.targetUser ? ` → ${l.targetUser.name}` : ''}
                        </div>
                        {auditDetail(l) && <div className="audit-row__detail">{auditDetail(l)}</div>}
                      </div>
                      <div className="audit-row__time">{formatDateTime(l.timestamp)}</div>
                    </div>
                  ))}
              </div>
              {logs.length > PAGE_SIZE && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '14px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    disabled={logsPage === 0}
                    onClick={() => setLogsPage((p) => Math.max(0, p - 1))}
                  >
                    <ChevronLeft size={14} /> Previous
                  </button>
                  <span className="muted" style={{ fontSize: '12.5px', fontWeight: 700 }}>
                    {logsPage * PAGE_SIZE + 1}–{Math.min((logsPage + 1) * PAGE_SIZE, logs.length)} of {logs.length}
                  </span>
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    disabled={(logsPage + 1) * PAGE_SIZE >= logs.length}
                    onClick={() => setLogsPage((p) => p + 1)}
                  >
                    Next <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {(activeTab === 'all' || activeTab === 'telegram') && (
        <section className="card">
          <div className="card__head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
              <Send size={16} /> Telegram Bot Integration
            </h3>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, userSelect: 'none' }}>
              <input
                type="checkbox"
                checked={telegramConfig.enabled}
                onChange={(e) => setTelegramConfig({ ...telegramConfig, enabled: e.target.checked })}
              />
              <span>{telegramConfig.enabled ? 'Enabled' : 'Disabled'}</span>
            </label>
          </div>
          <p className="muted card__hint">
            Live group updates for expenses, payments, duty swaps & daily 9:00 PM tomorrow&apos;s duty schedule sent directly to your housemates group.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '14px' }}>
            <div>
              <label className="field-label">Telegram Bot Token</label>
              <input
                type="text"
                className="text-input"
                value={telegramConfig.token}
                onChange={(e) => setTelegramConfig({ ...telegramConfig, token: e.target.value })}
                placeholder="e.g. 8826854405:AAEi..."
              />
            </div>
            <div>
              <label className="field-label">Telegram Group Chat ID</label>
              <input
                type="text"
                className="text-input"
                value={telegramConfig.chatId}
                onChange={(e) => setTelegramConfig({ ...telegramConfig, chatId: e.target.value })}
                placeholder="e.g. -1001234567890 or your Group ID"
              />
              <span className="muted" style={{ fontSize: '11.5px', marginTop: '4px', display: 'block', lineHeight: 1.4 }}>
                💡 <b>How to get Chat ID</b>: Add <b>@Sweet_Home_Updates_Bot</b> to your group, send any message in the group, and click <b>Send Test Msg 🚀</b>.
              </span>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
              <button
                type="button"
                className="btn btn--primary"
                disabled={tgSaving}
                onClick={saveTelegram}
              >
                {tgSaving ? 'Saving…' : 'Save Settings 💾'}
              </button>

              <button
                type="button"
                className="btn btn--ghost"
                disabled={tgTesting || !telegramConfig.token || !telegramConfig.chatId}
                onClick={testTelegram}
              >
                {tgTesting ? 'Sending…' : 'Send Test Msg 🚀'}
              </button>

              <button
                type="button"
                className="btn btn--ghost"
                disabled={tgChoresTesting || !telegramConfig.token || !telegramConfig.chatId}
                onClick={testChoresTelegram}
              >
                {tgChoresTesting ? 'Sending…' : "Send Tomorrow's Chores 🧹"}
              </button>

              <button
                type="button"
                className="btn btn--ghost"
                disabled={tgBalanceTesting || !telegramConfig.token || !telegramConfig.chatId}
                onClick={testBalanceTelegram}
              >
                {tgBalanceTesting ? 'Sending…' : 'Send Balance Update 💰'}
              </button>
            </div>
          </div>
        </section>
      )}

      <BottomSheet
        open={Boolean(pinTarget)}
        onClose={() => setPinTarget(null)}
        title={`Reset PIN — ${pinTarget?.name}`}
      >
        <div className="pin-modal-header" style={{ marginBottom: '12px' }}>
          <div className="pin-modal-icon">
            <KeyRound size={26} />
          </div>
          <p className="sheet-subtitle">Set a new 4-digit security PIN for <b>{pinTarget?.name}</b>.</p>
        </div>

        <div className="pin-dots" style={{ margin: '14px 0 20px' }}>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={`pin-dot ${newPin.length > i ? 'pin-dot--filled' : ''}`}>
              {newPin.length > i && <span className="pin-dot__inner" />}
            </span>
          ))}
        </div>

        <input
          className="text-input text-input--center"
          type="password"
          inputMode="numeric"
          maxLength={4}
          autoFocus
          value={newPin}
          onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
          placeholder="••••"
          style={{ letterSpacing: '8px', fontSize: '24px', fontWeight: 800, textAlign: 'center', marginBottom: '16px' }}
        />

        <div className="sheet-actions">
          <button type="button" className="btn btn--ghost" onClick={() => setPinTarget(null)}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary" disabled={pinBusy || newPin.length !== 4} onClick={confirmPinChange}>
            {pinBusy ? 'Saving…' : 'Set New PIN 🔒'}
          </button>
        </div>
      </BottomSheet>

      <BottomSheet
        open={Boolean(upiTarget)}
        onClose={() => setUpiTarget(null)}
        title={`Update UPI ID — ${upiTarget?.name}`}
      >
        <p className="sheet-subtitle">Set pre-stored UPI handle for {upiTarget?.name}.</p>
        <label className="field-label">UPI ID</label>
        <input
          className="text-input"
          type="text"
          value={newUpi}
          onChange={(e) => setNewUpi(e.target.value)}
          placeholder="e.g. name@okbank"
        />
        <div className="sheet-actions">
          <button type="button" className="btn btn--ghost" onClick={() => setUpiTarget(null)}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary" disabled={upiBusy || !newUpi.trim()} onClick={confirmUpiChange}>
            {upiBusy ? 'Saving…' : 'Save UPI ID'}
          </button>
        </div>
      </BottomSheet>

      <ConfirmModal
        open={confirmLogout}
        onClose={() => setConfirmLogout(false)}
        onConfirm={() => {
          setConfirmLogout(false);
          logout();
          toast.show('Admin mode locked');
        }}
        title="Lock Admin Mode"
        message="End the current admin session?"
        confirmLabel="Lock"
      />

      <ConfirmModal
        open={Boolean(roleTarget)}
        onClose={() => setRoleTarget(null)}
        onConfirm={confirmRoleChange}
        loading={roleBusy}
        title="Change Admin Access"
        message={
          roleTarget
            ? roleTarget.role === 'admin'
              ? `Remove admin access for ${roleTarget.name}? They will become a regular member.`
              : `Grant admin access to ${roleTarget.name}? They will be able to manage payments, expenses, chores, and users.`
            : ''
        }
        confirmLabel={roleTarget?.role === 'admin' ? 'Remove Admin' : 'Grant Admin'}
        danger={roleTarget?.role === 'admin'}
      />
    </div>
  );
}
