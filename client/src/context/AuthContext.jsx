import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { verifyPin as verifyPinApi } from '../services/users';
import { SESSION_KEY } from '../constants';
import { useToast } from './ToastContext';
import PinModal from '../components/PinModal';

const AuthContext = createContext(null);

function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s.token || !s.user || Date.now() >= s.expiresAt) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return s;
  } catch (_) {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(loadSession);
  const [request, setRequest] = useState(null);
  const toast = useToast();
  const timerRef = useRef(null);

  const persistSession = useCallback((data) => {
    const expiresAt = Date.now() + (Number(data.expiresIn) || 300) * 1000;
    const s = { token: data.token, user: data.user, expiresAt };
    setSession(s);
    localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    return s;
  }, []);

  const logout = useCallback(() => {
    setSession(null);
    localStorage.removeItem(SESSION_KEY);
  }, []);

  useEffect(() => {
    if (!session) return undefined;
    const ms = Math.max(0, session.expiresAt - Date.now());
    timerRef.current = setTimeout(() => {
      logout();
      toast.show('Admin mode expired. Verify again to continue.', 'info');
    }, ms);
    return () => clearTimeout(timerRef.current);
  }, [session, logout, toast]);

  const verifyPin = useCallback(
    async (name, pin) => {
      const data = await verifyPinApi(name, pin);
      if (data.user.role === 'admin') persistSession(data);
      return data;
    },
    [persistSession]
  );

  const requestIdentity = useCallback((opts) => {
    return new Promise((resolve, reject) => {
      setRequest({ ...opts, resolve, reject });
    });
  }, []);

  const cancelIdentity = useCallback(() => {
    setRequest((r) => {
      if (r) r.reject(new Error('Cancelled'));
      return null;
    });
  }, []);

  const onVerified = useCallback(
    async (name, pin) => {
      const r = request;
      if (!r) return;
      // Any failure throws here and is caught by PinModal (inline error),
      // leaving the identity promise pending so the user can retry.
      const data = await verifyPin(name, pin);
      if (r.adminOnly && data.user.role !== 'admin') {
        throw new Error('Admin permission required');
      }
      setRequest(null);
      r.resolve(data);
    },
    [request, verifyPin]
  );

  const runWithAuth = useCallback(
    async (opts, fn) => {
      if (session && session.user.role === 'admin' && Date.now() < session.expiresAt) {
        return fn(session.token, session.user);
      }
      const data = await requestIdentity(opts);
      return fn(data.token, data.user);
    },
    [session, requestIdentity]
  );

  const isAdmin = Boolean(session && session.user.role === 'admin');

  return (
    <AuthContext.Provider
      value={{
        session,
        isAdmin,
        adminUser: session?.user || null,
        verifyPin,
        logout,
        runWithAuth,
        requestIdentity
      }}
    >
      {children}
      <PinModal
        open={Boolean(request)}
        title={request?.title}
        subtitle={request?.subtitle}
        adminOnly={request?.adminOnly}
        defaultName={request?.defaultName}
        busy={false}
        onVerified={onVerified}
        onCancel={cancelIdentity}
      />
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
