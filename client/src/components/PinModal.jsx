import { useState, useEffect } from 'react';
import { Delete } from 'lucide-react';
import BottomSheet from './BottomSheet';
import { useApp } from '../context/AppContext';

const KEYPAD = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

export default function PinModal({ open, title, adminOnly, defaultName, busy, onVerified, onCancel }) {
  const { users } = useApp();
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setName(defaultName || '');
      setPin('');
      setError('');
      setLoading(false);
    }
  }, [open, defaultName]);

  const handleClose = () => {
    onCancel?.();
  };

  const handlePress = (key) => {
    setError('');
    if (key === '⌫') {
      setPin((p) => p.slice(0, -1));
      return;
    }
    if (key && pin.length < 4) setPin((p) => p + key);
  };

  const handleVerify = async () => {
    if (!name || pin.length !== 4 || loading) return;
    setLoading(true);
    try {
      await onVerified(name, pin);
    } catch (err) {
      setError(err.message || 'Incorrect PIN');
      setPin('');
      setLoading(false);
    }
  };

  const canVerify = name && pin.length === 4;

  return (
    <BottomSheet open={open} onClose={handleClose} title={title || 'Enter PIN'} maxWidth={420}>
      <div className="compact-pin-modal">
        {error && <div className="notice notice--error" style={{ padding: '6px 10px', fontSize: '12px', marginBottom: '4px' }}>{error}</div>}

        {/* User Selection Chips */}
        <div className="name-grid compact-name-grid">
          {(adminOnly ? users.filter((u) => u.role === 'admin') : users).map((u) => (
            <button
              key={u._id}
              type="button"
              className={`name-chip compact-chip ${name === u.name ? 'name-chip--active' : ''}`}
              onClick={() => {
                setName(u.name);
                setError('');
              }}
            >
              {u.name}
            </button>
          ))}
        </div>

        {/* PIN Dots */}
        <div className={`pin-dots compact-pin-dots ${error ? 'pin-dots--shake' : ''}`}>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={`pin-dot ${pin.length > i ? 'pin-dot--filled' : ''}`}>
              {pin.length > i && <span className="pin-dot__inner" />}
            </span>
          ))}
        </div>

        {/* Keypad */}
        <div className="keypad compact-keypad">
          {KEYPAD.map((k, i) => (
            <button
              key={i}
              type="button"
              className={`keypad-key compact-key ${k === '' ? 'keypad-key--ghost' : ''} ${k === '⌫' ? 'keypad-key--backspace' : ''}`}
              onClick={() => k && handlePress(k)}
              disabled={k === ''}
            >
              {k === '⌫' ? <Delete size={18} /> : k}
            </button>
          ))}
        </div>

        {/* Actions */}
        <div className="sheet-actions compact-actions">
          <button type="button" className="btn btn--ghost btn--sm" onClick={handleClose}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary btn--sm" disabled={!canVerify || loading || busy} onClick={handleVerify} style={{ flex: 1 }}>
            {loading || busy ? 'Verifying…' : 'Confirm'}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
