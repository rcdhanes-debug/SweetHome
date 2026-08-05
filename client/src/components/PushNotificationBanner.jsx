import { useState, useEffect } from 'react';
import { Bell, X } from 'lucide-react';
import { isPushSupported, subscribeToPush } from '../services/push';

export default function PushNotificationBanner() {
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isPushSupported()) return;

    // If browser already has permission, never show the banner
    if (Notification.permission === 'granted') return;

    // If browser blocked permission, nothing we can do
    if (Notification.permission === 'denied') return;

    // If user dismissed the banner before, respect that
    if (localStorage.getItem('push-banner-dismissed') === 'true') return;

    // Only show banner if permission is still 'default' (not yet asked)
    setShow(true);
  }, []);

  const handleEnable = async () => {
    setLoading(true);
    try {
      await subscribeToPush();
      // Hide banner permanently once permission is granted
      setShow(false);
    } catch (err) {
      // If user denied in the popup, hide banner too (nothing more to do)
      if (Notification.permission === 'denied' || Notification.permission === 'granted') {
        setShow(false);
      }
      console.warn('[push]', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem('push-banner-dismissed', 'true');
    setShow(false);
  };

  if (!show) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        background: 'var(--card-bg)',
        border: '1px solid var(--border)',
        borderRadius: '14px',
        padding: '12px 14px',
        marginBottom: '12px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.12)'
      }}
    >
      <Bell size={18} style={{ color: 'var(--accent)', flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '2px' }}>
          Enable Push Notifications
        </div>
        <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
          Get alerts for cooking duty, balance &amp; contributions
        </div>
      </div>
      <button
        type="button"
        className="btn btn--primary btn--sm"
        disabled={loading}
        onClick={handleEnable}
        style={{ flexShrink: 0 }}
      >
        {loading ? <span className="spinner" /> : <><Bell size={13} /> Enable</>}
      </button>
      <button
        type="button"
        className="icon-btn icon-btn--sm"
        onClick={handleDismiss}
        aria-label="Dismiss"
        style={{ flexShrink: 0 }}
      >
        <X size={14} />
      </button>
    </div>
  );
}
