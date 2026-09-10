/* AERO-OPS Attendance PWA — service worker
   Strategy:
   - App shell (static assets): cache-first, refreshed in background
   - API GETs: network-first with cache fallback (stale data shown when offline)
   - API POST/PUT/PATCH: never cached — handled by the in-app offline queue
   - Navigation: network-first, offline shell fallback
*/
const CACHE_NAME = 'aeroops-v1';
const APP_SHELL = ['/', '/index.html', '/manifest.json', '/icons/icon.svg'];
const API_CACHE = 'aeroops-api-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME && k !== API_CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Never cache cross-origin or non-GET
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  // API requests: network-first with graceful fallback
  if (url.pathname.startsWith('/api')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const clone = res.clone();
          caches.open(API_CACHE).then((c) => c.put(req, clone));
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || new Response(
          JSON.stringify({ success: false, message: 'Offline — showing cached data', code: 'OFFLINE' }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        )))
    );
    return;
  }

  // Static assets: cache-first
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req).then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, clone));
        }
        return res;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});

// Push notification support (optional, permission-gated)
self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload = {};
  try { payload = event.data.json(); } catch { payload = { title: 'AERO-OPS', body: event.data.text() }; }
  event.waitUntil(
    self.registration.showNotification(payload.title || 'AERO-OPS Attendance', {
      body: payload.body || '',
      icon: '/icons/icon.svg',
      badge: '/icons/icon.svg',
      data: { url: payload.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url || '/'));
});
