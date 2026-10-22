// Service Worker for Sweet Home with Web Push Notification Handlers
const CACHE_NAME = 'sweethome-v2';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Pass-through to network so dev server and hot reloading work normally without stale caching
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});

// --- Web Push Notification Handlers ---

self.addEventListener('push', (event) => {
  if (!event.data) return;
  let data = {};
  try {
    data = event.data.json();
  } catch {
    data = { title: 'Sweet Home', body: event.data.text() };
  }
  const title = data.title || 'Sweet Home';
  const options = {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: data.data || {},
    vibrate: [100, 50, 100],
    tag: data.tag || 'sweet-home-push'
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
