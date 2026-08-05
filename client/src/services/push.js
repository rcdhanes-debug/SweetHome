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
  try {
    const reg = await navigator.serviceWorker.ready;
    if (!reg) return;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    await api.post('/push/unsubscribe', { endpoint: sub.endpoint });
    await sub.unsubscribe();
  } catch (err) {
    console.warn('[push] unsubscribe failed:', err);
  }
}

export async function getCurrentSubscription() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
  try {
    // Use navigator.serviceWorker.ready — returns the active registration regardless of SW script path.
    // getRegistration(path) looks for a scope match, not the script URL, which caused false nulls.
    const reg = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
    ]);
    if (!reg) return null;
    return await reg.pushManager.getSubscription();
  } catch {
    return null;
  }
}

export function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export async function getSubscriberCount() {
  const res = await api.get('/push/subscribers');
  return res.data?.count ?? 0;
}

export async function sendTestPush() {
  const res = await api.post('/push/send-test');
  return res.data;
}

export async function sendCookingPush() {
  const res = await api.post('/push/send-cooking');
  return res.data;
}

export async function sendBalancePush() {
  const res = await api.post('/push/send-balance');
  return res.data;
}

export async function sendContributionPush() {
  const res = await api.post('/push/send-contribution');
  return res.data;
}

