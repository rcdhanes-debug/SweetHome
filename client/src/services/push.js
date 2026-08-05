import api from './api';

const SW_PATH = '/sw.js';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register(SW_PATH);
    return reg;
  } catch (err) {
    console.error('[push] Service worker registration failed:', err);
    return null;
  }
}

export async function getVapidPublicKey() {
  const res = await api.get('/push/vapid-public-key');
  return res.data.publicKey;
}

export async function subscribeToPush() {
  if (!('Notification' in window) || !('PushManager' in window)) {
    throw new Error('Push notifications not supported in this browser.');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notification permission denied.');
  }

  const reg = await registerServiceWorker();
  if (!reg) throw new Error('Service worker not available.');

  await navigator.serviceWorker.ready;

  const publicKey = await getVapidPublicKey();
  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey)
  });

  await api.post('/push/subscribe', { subscription });
  return subscription;
}

export async function unsubscribeFromPush() {
  if (!('serviceWorker' in navigator)) return;
  const reg = await navigator.serviceWorker.getRegistration(SW_PATH);
  if (!reg) return;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  await api.post('/push/unsubscribe', { endpoint: sub.endpoint });
  await sub.unsubscribe();
}

export async function getCurrentSubscription() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
  try {
    const reg = await navigator.serviceWorker.getRegistration(SW_PATH);
    if (!reg) return null;
    return await reg.pushManager.getSubscription();
  } catch {
    return null;
  }
}

export function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}
