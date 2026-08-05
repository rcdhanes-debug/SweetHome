import { useState, useEffect } from 'react';
import { Bell, X } from 'lucide-react';
import { isPushSupported, subscribeToPush, getCurrentSubscription } from '../services/push';

const LS_KEY = 'push-enabled';

export default function PushNotificationBanner() {
  // Start hidden until we've checked — avoids flash
  const [ready, setReady] = useState(false);
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [permission, setPermission] = useState('default');

  useEffect(() => {
    if (!isPushSupported()) { setReady(true); return; }
    setSupported(true);
    setPermission(Notification.permission);

    // If permission already denied, nothing to show
    if (Notification.permission === 'denied') { setReady(true); return; }

    // If localStorage says already subscribed, hide immediately without async wait
    if (localStorage.getItem(LS_KEY) === 'true') {
      setSubscribed(true);
      setReady(true);
      return;
    }

    // If dismissed, hide
    if (localStorage.getItem('push-banner-dismissed') === 'true') {
      setDismissed(true);
      setReady(true);
      return;
    }

    // Async verify actual subscription (covers cases where user cleared browser data)
    getCurrentSubscription().then((sub) => {
      if (sub) {
        localStorage.setItem(LS_KEY, 'true');
        setSubscribed(true);
      }
      setReady(true);
    }).catch(() => setReady(true));
  }, []);

  const handleEnable = async () => {
    setLoading(true);
    try {
      await subscribeToPush();
      localStorage.setItem(LS_KEY, 'true');
      setSubscribed(true);
      setPermission('granted');
    } catch (err) {
      if (err.message.includes('denied')) setPermission('denied');
      console.warn('[push]', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem('push-banner-dismissed', 'true');
    setDismissed(true);
  };

  // Don't render until we've checked state (prevents flash)
  if (!ready) return null;

  // Hide if not supported, already subscribed, dismissed, or blocked
  if (!supported || subscribed || dismissed || permission === 'denied') return null;

  return (
    <div
      className="push-banner"
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
