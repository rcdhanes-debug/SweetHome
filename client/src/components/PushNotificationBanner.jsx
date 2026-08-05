import { useState, useEffect } from 'react';
import { Bell, X } from 'lucide-react';
import { isPushSupported, subscribeToPush } from '../services/push';
import { useToast } from '../context/ToastContext';

export default function PushNotificationBanner() {
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (!isPushSupported()) return;

    // If user already dismissed, don't show banner
    if (localStorage.getItem('push-banner-dismissed') === 'true') return;

    // If permission is already granted, auto-sync subscription with backend silently
    if (Notification.permission === 'granted') {
      subscribeToPush().catch((err) => console.warn('[push auto-sync failed]', err));
      return;
    }

    // If browser blocked permission, don't show banner
    if (Notification.permission === 'denied') return;

    // Show banner only if permission is 'default' (not yet asked)
    setShow(true);
  }, []);

  const handleEnable = async () => {
    setLoading(true);
    try {
      await subscribeToPush();
      localStorage.setItem('push-banner-dismissed', 'true');
      setShow(false);
      toast.show('✓ Push notifications enabled successfully!');
    } catch (err) {
      console.error('[push enable error]', err);
      toast.show(`Failed to enable push: ${err.message}`, 'error');
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
