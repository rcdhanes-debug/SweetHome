import api from './api';

const SW_PATH = '/sw.js';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
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
  return res?.publicKey || res?.data?.publicKey;
}

export async function subscribeToPush() {
  if (!isPushSupported()) {
    throw new Error('Push notifications not supported in this browser.');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notification permission denied.');
  }

  const reg = await registerServiceWorker();
  if (!reg) throw new Error('Service worker not available.');

  const activeReg = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise((resolve) => setTimeout(() => resolve(reg), 2000))
  ]).catch(() => reg);

  const publicKey = await getVapidPublicKey();
  if (!publicKey) throw new Error('Failed to retrieve VAPID public key from server.');

  let sub = await activeReg.pushManager.getSubscription();
  if (!sub) {
    sub = await activeReg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey)
    });
  }

  const payload = sub.toJSON ? sub.toJSON() : JSON.parse(JSON.stringify(sub));
  await api.post('/push/subscribe', { subscription: payload });
  return sub;
}

export async function unsubscribeFromPush() {
  if (!isPushSupported()) return;
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
  if (!isPushSupported()) return null;
  try {
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

export async function getSubscriberCount() {
  const res = await api.get('/push/subscribers');
  return res?.count ?? res?.data?.count ?? 0;
}

export async function sendTestPush() {
  const res = await api.post('/push/send-test');
  return res;
}

export async function sendCookingPush() {
  const res = await api.post('/push/send-cooking');
  return res;
}

export async function sendBalancePush() {
  const res = await api.post('/push/send-balance');
  return res;
}

export async function sendContributionPush() {
  const res = await api.post('/push/send-contribution');
  return res;
}
