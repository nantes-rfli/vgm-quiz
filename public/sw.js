self.__APP_VERSION__ = new URL(self.location).searchParams.get('v');
const CACHE_NAME = 'vgm-quiz-' + (self.__APP_VERSION__ || 'dev');
const CORE_ASSETS = [
  './',
  './index.html',
  './app.js',
  './manifest.webmanifest'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});
self.addEventListener('activate', e => { e.waitUntil(self.clients.claim()); });

self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    if (url.pathname.endsWith('/build/dataset.json')) {
      event.respondWith((async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(event.request);
        const network = fetch(event.request, { cache: 'no-store' }).then(async r => {
          if (r.ok) await cache.put(event.request, r.clone());
          return r;
        }).catch(() => {});
        event.waitUntil(network);
        return cached || network;
      })());
      return;
    }
    if (url.pathname.endsWith('/build/version.json')) {
      event.respondWith((async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(event.request);
        const network = fetch(event.request, { cache: 'no-store' }).then(async r => {
          if (r.ok) {
            await cache.put(event.request, r.clone());
            const clients = await self.clients.matchAll();
            clients.forEach(c => c.postMessage({ type: 'version-refreshed' }));
          }
          return r;
        }).catch(() => {});
        event.waitUntil(network);
        return cached || network;
      })());
      return;
    }
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(event.request);
      const fetchPromise = fetch(event.request).then(async r => {
        if (r.ok) await cache.put(event.request, r.clone());
        return r;
      }).catch(() => {});
      if (cached) event.waitUntil(fetchPromise);
      return cached || fetchPromise;
    })());
  });

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
