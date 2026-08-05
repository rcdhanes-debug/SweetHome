import { useState } from 'react';
import { Bell, BellRing, X, Wallet, CalendarClock, CheckCircle2, Receipt, Trash2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import BottomSheet from './BottomSheet';
import EmptyState from './EmptyState';

const TYPE_META = {
  CONTRIBUTION_DUE: { icon: Wallet, color: 'var(--orange)' },
  EVENT_REMINDER: { icon: CalendarClock, color: 'var(--accent-2)' },
  PAYMENT_MADE: { icon: CheckCircle2, color: 'var(--green)' },
  EXPENSE_ADDED: { icon: Receipt, color: '#8b5cf6' },
  GENERAL: { icon: Bell, color: 'var(--muted)' }
};

function timeAgo(iso) {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return days === 1 ? 'yesterday' : `${days}d ago`;
}

export default function NotificationBell() {
  const { notifications, markAllRead, dismissNotification, clearAllNotifications } = useApp();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const unread = notifications.filter((n) => !n.read).length;

  const openSheet = () => {
    setOpen(true);
    if (unread > 0) markAllRead();
  };

  const handleClearAll = async () => {
    setBusy(true);
    try {
      await clearAllNotifications();
    } catch (err) {
      console.error('Failed to clear notifications:', err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="bell-btn"
        onClick={openSheet}
        aria-label="Notifications"
      >
        {unread > 0 ? <BellRing size={18} style={{ color: 'var(--accent-2)' }} /> : <Bell size={18} />}
        {unread > 0 && <span className="bell-btn__badge">{unread > 9 ? '9+' : unread}</span>}
      </button>

      <BottomSheet open={open} onClose={() => setOpen(false)} title="Notifications" maxWidth={520}>
        {notifications.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={handleClearAll}
              disabled={busy}
              style={{ color: 'var(--red)', gap: '6px', fontSize: '13px', fontWeight: 700 }}
            >
              <Trash2 size={14} /> Clear All
            </button>
          </div>
        )}

        {notifications.length === 0 ? (
          <EmptyState icon="🔔" title="All caught up" subtitle="Reminders about dues and website activity will appear here." />
        ) : (
          <div className="nb-list">
            {notifications.map((n) => {
              const meta = TYPE_META[n.type] || TYPE_META.GENERAL;
              const Icon = meta.icon;
              return (
                <div key={n._id} className="nb-row">
                  <span className="upcoming-row__icon" style={{ color: meta.color }}>
                    <Icon size={18} />
                  </span>
                  <div className="nb-row__body">
                    <div className="nb-row__text">{n.title}</div>
                    {n.message && <div className="nb-row__desc">{n.message}</div>}
                    <div className="nb-row__meta">{timeAgo(n.createdAt)}</div>
                  </div>
                  <button
                    type="button"
                    className="icon-btn icon-btn--sm"
                    onClick={() => dismissNotification(n._id)}
                    title="Dismiss"
                  >
                    <X size={15} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </BottomSheet>
    </>
  );
}
