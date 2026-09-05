/* Service Worker — لوحة الإشعارات الفورية (Web Push).
 * يعمل مع اشتراكات /push/subscribe. يوفّر عرض الإشعارات وفتح/تركيز عند النقر. */
const VERSION = 'v1';
const APP_ID = 'rafidain-agent';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => !k.startsWith(`${APP_ID}-${VERSION}`)).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('push', (event) => {
  let data = { title: 'لوحة الوكيل', body: '', url: '/' };
  try {
    const json = event.data ? event.data.json() : {};
    data = { title: json.title || data.title, body: json.body || data.body, url: json.url || data.url, icon: json.icon || '' };
  } catch (_) {
    data.body = event.data ? event.data.text() : data.body;
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || '/icons/icon-192.png',
      badge: data.icon || '/icons/icon-192.png',
      data: { url: data.url },
      tag: `${APP_ID}-notification`,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === url) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const { pathname } = new URL(event.request.url);
  if (pathname.startsWith('/api') || pathname.startsWith('/uploads')) return;
  event.respondWith(
    caches.open(`${APP_ID}-${VERSION}`).then((cache) =>
      cache.match(event.request).then((cached) => {
        const fetched = fetch(event.request).then((response) => {
          if (response.ok && response.type === 'basic') cache.put(event.request, response.clone());
          return response;
        }).catch(() => cached);
        return cached || fetched;
      })
    )
  );
});