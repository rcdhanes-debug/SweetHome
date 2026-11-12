import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Delete, Eye, EyeOff, Lock, RotateCcw, ShieldCheck } from 'lucide-react';
import BottomSheet from './BottomSheet';
import Avatar from './Avatar';
import { useApp } from '../context/AppContext';

const KEYPAD = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'];

export default function PinModal({ open, title, subtitle, adminOnly, defaultName, busy, onVerified, onCancel }) {
  const { users } = useApp();
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState('');
  const [shakeKey, setShakeKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);

  const filteredUsers = useMemo(
    () => (adminOnly ? users.filter((u) => u.role === 'admin') : users),
    [users, adminOnly]
  );

  useEffect(() => {
    if (!open) return;
    const validDefault =
      defaultName && filteredUsers.some((u) => u.name === defaultName)
        ? defaultName
        : filteredUsers.length === 1
          ? filteredUsers[0].name
          : '';
    setName(validDefault);
    setPin('');
    setShowPin(false);
    setError('');
    setLoading(false);
    submittingRef.current = false;
  }, [open, defaultName, filteredUsers]);

  const handleClose = useCallback(() => {
    if (submittingRef.current) return;
    onCancel?.();
  }, [onCancel]);

  const submitPin = useCallback(
    async (targetName, targetPin) => {
      if (!targetName || targetPin.length !== 4 || submittingRef.current) return;
      submittingRef.current = true;
      setLoading(true);
      setError('');
      try {
        await onVerified(targetName, targetPin);
      } catch (err) {
        setError(err.message || 'Incorrect PIN');
        setPin('');
        setShakeKey((k) => k + 1);
      } finally {
        submittingRef.current = false;
        setLoading(false);
      }
    },
    [onVerified]
  );

  const handlePress = useCallback(
    (key) => {
      if (submittingRef.current || busy) return;
      setError('');
      if (key === '⌫') {
        setPin((p) => p.slice(0, -1));
        return;
      }
      if (key === 'C') {
        setPin('');
        return;
      }
      if (/^\d$/.test(key)) {
        setPin((prev) => {
          if (prev.length >= 4) return prev;
          const next = prev + key;
          if (next.length === 4 && name) {
            queueMicrotask(() => submitPin(name, next));
          }
          return next;
        });
      }
    },
    [busy, name, submitPin]
  );

  // Support physical keyboard entry (0-9, Backspace, Delete/C, Enter) when modal is open.
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^\d$/.test(e.key)) {
        e.preventDefault();
        handlePress(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handlePress('⌫');
      } else if (e.key === 'Delete' || e.key.toLowerCase() === 'c') {
        e.preventDefault();
        handlePress('C');
      } else if (e.key === 'Enter') {
        if (name && pin.length === 4) {
          e.preventDefault();
          submitPin(name, pin);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, handlePress, name, pin, submitPin]);

  const selectedUser = useMemo(
    () => filteredUsers.find((u) => u.name === name) || null,
    [filteredUsers, name]
  );

  const canVerify = Boolean(name && pin.length === 4);
  const isBusy = loading || busy;

  return (
    <BottomSheet open={open} onClose={handleClose} title={title || 'Enter PIN'} maxWidth={420}>
      <div className="compact-pin-modal">
        {(subtitle || adminOnly) && (
          <div className="pin-context-bar">
            <span className="pin-context-bar__icon" aria-hidden="true">
              {adminOnly ? <ShieldCheck size={14} /> : <Lock size={14} />}
            </span>
            <span className="pin-context-bar__text">
              {subtitle || 'Verify your identity to continue'}
            </span>
            {adminOnly && <span className="badge badge--admin">Admin</span>}
          </div>
        )}

        {error && (
          <div className="notice notice--error pin-error-banner" role="alert">
            {error}
          </div>
        )}

        {/* User Selection Chips */}
        <div className="pin-section-label">
          <span>{selectedUser ? `Signing in as ${selectedUser.name}` : 'Select who you are'}</span>
        </div>
        <div className="compact-name-grid" role="listbox" aria-label="Select housemate">
          {filteredUsers.map((u) => {
            const active = name === u.name;
            return (
              <button
                key={u._id}
                type="button"
                role="option"
                aria-selected={active}
                className={`name-chip compact-chip ${active ? 'name-chip--active' : ''}`}
                onClick={() => {
                  setName(u.name);
                  setError('');
                  if (pin.length === 4) {
                    submitPin(u.name, pin);
                  }
                }}
              >
                <Avatar user={u} name={u.name} size={20} />
                <span>{u.name}</span>
                {u.role === 'admin' && !adminOnly && (
                  <ShieldCheck size={12} className="compact-chip__admin" aria-label="Admin" />
                )}
              </button>
            );
          })}
        </div>

        {/* 4-Digit PIN Slots + Visibility Toggle */}
        <div className="pin-slots-row">
          <div
            key={shakeKey}
            className={`pin-slots ${error ? 'pin-dots--shake' : ''}`}
            aria-label={`PIN entered: ${pin.length} of 4 digits`}
          >
            {[0, 1, 2, 3].map((i) => {
              const filled = pin.length > i;
              const isCurrent = pin.length === i && !isBusy;
              return (
                <div
                  key={i}
                  className={`pin-slot ${filled ? 'pin-slot--filled' : ''} ${isCurrent ? 'pin-slot--active' : ''} ${error ? 'pin-slot--error' : ''}`}
                >
                  {filled ? (
                    showPin ? (
                      <span className="pin-slot__digit">{pin[i]}</span>
                    ) : (
                      <span className="pin-slot__dot" />
                    )
                  ) : null}
                </div>
              );
            })}
          </div>
          <button
            type="button"
            className="pin-eye-btn"
            onClick={() => setShowPin((s) => !s)}
            aria-label={showPin ? 'Hide PIN' : 'Show PIN'}
            title={showPin ? 'Hide PIN' : 'Show PIN'}
          >
            {showPin ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>

        {!name && pin.length > 0 && (
          <div className="pin-hint">Select your name above to verify</div>
        )}

        <div className="pin-keyboard-hint">Type your 4-digit PIN on your keyboard</div>

        {/* Keypad */}
        <div className="keypad compact-keypad">
          {KEYPAD.map((k) => {
            const isClear = k === 'C';
            const isBackspace = k === '⌫';
            const disabled = isBusy || (isClear && pin.length === 0) || (isBackspace && pin.length === 0);
            return (
              <button
                key={k}
                type="button"
                className={`keypad-key compact-key ${isClear ? 'keypad-key--utility' : ''} ${isBackspace ? 'keypad-key--backspace' : ''}`}
                onClick={() => handlePress(k)}
                disabled={disabled}
                aria-label={isClear ? 'Clear PIN' : isBackspace ? 'Backspace' : k}
              >
                {isBackspace ? <Delete size={18} /> : isClear ? <RotateCcw size={16} /> : k}
              </button>
            );
          })}
        </div>

        {/* Actions */}
        <div className="sheet-actions compact-actions">
          <button type="button" className="btn btn--ghost btn--sm" onClick={handleClose} disabled={isBusy}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn--primary btn--sm"
            disabled={!canVerify || isBusy}
            onClick={() => submitPin(name, pin)}
            style={{ flex: 1 }}
          >
            {isBusy ? 'Verifying…' : 'Confirm'}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
