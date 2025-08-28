self.__APP_VERSION__ = new URL(self.location).searchParams.get('v');
const CACHE_NAME = 'vgm-quiz-' + (self.__APP_VERSION__ || 'dev');

self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req, { cache: 'no-store' }));
    return;
  }
  const url = new URL(req.url);
  // ... existing routes ...
  if (url.pathname.endsWith('/build/dataset.json')) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(req);
      const network = fetch(req, { cache: 'no-store' }).then(async r => {
        if (r.ok) await cache.put(req, r.clone());
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
      const cached = await cache.match(req);
      const network = fetch(req, { cache: 'no-store' }).then(async r => {
        if (r.ok) {
          await cache.put(req, r.clone());
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

  // NEW: build.json は常に最新（network-first）かつキャッシュしない
  if (url.pathname.endsWith('/build.json') || url.pathname.endsWith('/app/build.json')) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req, { cache: 'no-store' });
        if (fresh && fresh.ok) return fresh;
      } catch (e) {
        // fallthrough
      }
      // 最悪でもキャッシュを試す（ただし通常は入っていない想定）
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(req);
      return cached || fetch(req, { cache: 'no-store' });
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(req);
    const fetchPromise = fetch(req, { cache: 'no-store' }).then(async r => {
      if (r.ok) await cache.put(req, r.clone());
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

