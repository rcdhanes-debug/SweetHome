import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import api from '../services/api';

export default function UpdateBanner() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [initialVersion, setInitialVersion] = useState(null);

  useEffect(() => {
    let checkTimer;

    const checkVersion = async () => {
      try {
        const res = await api.get('/version');
        const serverVer = res.data?.version;
        if (!serverVer) return;

        setInitialVersion((prev) => {
          if (!prev) return serverVer;
          if (prev !== serverVer) {
            setUpdateAvailable(true);
          }
          return prev;
        });
      } catch (_) {}
    };

    checkVersion();

    const onVisibility = () => {
      if (document.visibilityState === 'visible') checkVersion();
    };

    window.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', checkVersion);
    checkTimer = setInterval(checkVersion, 3 * 60 * 1000);

    return () => {
      window.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', checkVersion);
      clearInterval(checkTimer);
    };
  }, []);

  if (!updateAvailable) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
        color: '#ffffff',
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        fontSize: '13px',
        fontWeight: 600
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <RefreshCw size={16} className="spinning" />
        <span>New Sweet Home update available!</span>
      </div>
      <button
        type="button"
        onClick={() => window.location.reload(true)}
        style={{
          background: '#ffffff',
          color: '#4f46e5',
          border: 'none',
          padding: '6px 14px',
          borderRadius: '999px',
          fontWeight: 700,
          fontSize: '12px',
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
        }}
      >
        Reload Now
      </button>
    </div>
  );
}
