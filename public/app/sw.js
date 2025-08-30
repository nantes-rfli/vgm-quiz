/* eslint-disable no-restricted-globals */
'use strict';
self.__APP_VERSION__ = new URL(self.location).searchParams.get('v');
const CACHE_NAME = 'vgm-quiz-' + (self.__APP_VERSION__ || 'dev');

let VERMETA_URL = undefined; // app側から受け取る最優先URL

// app から version.json の絶対URLを受け取る
self.addEventListener('message', (event) => {
  try {
    const data = event?.data || {};
    if (data.type === 'version_url' && typeof data.url === 'string' && data.url) {
      VERMETA_URL = data.url;
      // デバッグに活用したい場合は次行を有効化
      // console.log('[sw] set version_url:', VERMETA_URL);
    }
  } catch (e) {}
});

function computeVersionUrl() {
  // 1) app から受け取った絶対URLがあればそれを使う
  if (VERMETA_URL) return VERMETA_URL;
  // 2) 既存ロジック（スコープ依存の相対→絶対解決）
  try {
    const u = new URL('../build/version.json', self.registration.scope);
    // /app/build/ に解決されてしまう環境では /build/ に補正
    const s = u.toString().replace(/\/app\/build\//, '/build/');
    return s;
  } catch (_) {
    try {
      return new URL('../build/version.json', self.location).toString();
    } catch (_) {
      return './build/version.json';
    }
  }
}
const MIN_CHECK_INTERVAL_MS = 60 * 1000; // 最短60秒
const CLIENT_POST_DEBOUNCE_MS = 60 * 1000; // 通知も最短60秒にデボンス
let __versionWatchStarted = false;
let __lastCheckAt = 0;
let __lastNotifyAt = 0;
let __lastETag = null;
let __lastHash = null;
// -----------------------------------------------------------------------

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

// ====== バージョン定期チェック =======================================
async function safeFetchVersion() {
  try {
    const init = { cache: 'no-store', headers: {} };
    if (__lastETag) init.headers['If-None-Match'] = __lastETag;
    const res = await fetch(computeVersionUrl(), init);
    if (res.status === 304) return { notModified: true };
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    __lastETag = res.headers.get('ETag');
    const j = await res.json();
    return { json: j };
  } catch (err) {
    return { error: String(err) };
  }
}

async function checkAndNotify() {
  const now = Date.now();
  if (now - __lastCheckAt < MIN_CHECK_INTERVAL_MS) return;
  __lastCheckAt = now;
  const { json, notModified } = await safeFetchVersion();
  if (notModified || !json) return;
  const newHash = json.content_hash || json.hash || json.commit || null;
  if (!newHash || newHash === __lastHash) return;
  __lastHash = newHash;
  if (now - __lastNotifyAt < CLIENT_POST_DEBOUNCE_MS) return;
  __lastNotifyAt = now;
  const all = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
  for (const c of all) {
    c.postMessage({ type: 'version-refreshed', content_hash: newHash });
  }
}

function startVersionWatch() {
  if (__versionWatchStarted) return;
  __versionWatchStarted = true;
  const loop = async () => {
    await checkAndNotify();
    setTimeout(loop, MIN_CHECK_INTERVAL_MS);
  };
  loop();
}

startVersionWatch();

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'force-version-check') {
    checkAndNotify();
  }
});

