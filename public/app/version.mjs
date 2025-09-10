// Extracted by v1.12 UI-slim Phase 1
const VERSION_URL = '../build/version.json';
const HASH_KEY = 'dataset_hash';
// === バージョン読み取りのメモ化（60s TTL） ========================
const VERSION_TTL_MS = 60_000;
const VERSION_TIMEOUT_MS = 8_000; // 8s に延長
let __readVersionCache = { ts: 0, data: null, etag: null };
let __readVersionInflight = null;  // ★ in-flight共有

async function readVersionNoStore(force = false) {
  if (!force) {
    if (__readVersionInflight) return __readVersionInflight;
    if (__readVersionCache.data && (Date.now() - __readVersionCache.ts) < VERSION_TTL_MS) {
      return __readVersionCache.data;
    }
  }
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), VERSION_TIMEOUT_MS);
  try {
    const init = { signal: ctrl.signal, cache: 'no-store', headers: {} };
    if (__readVersionCache.etag) init.headers['If-None-Match'] = __readVersionCache.etag;
    const p = (async () => {
      const res = await fetch(VERSION_URL, init);
      if (res.status === 304 && __readVersionCache.data) {
        __readVersionCache.ts = Date.now();
        return __readVersionCache.data;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const etag = res.headers.get('ETag');
      const data = await res.json();
      __readVersionCache = { ts: Date.now(), data, etag };
      return data;
    })();
    __readVersionInflight = p;
    const data = await p;
    return data;
  } catch (_) {
    if (__readVersionCache.data) return __readVersionCache.data;
    return { dataset: 'mock', commit: 'local', content_hash: 'local' };
  } finally {
    clearTimeout(t);
    __readVersionInflight = null; // in-flight解除
  }
}
function rememberHash(h){ localStorage.setItem(HASH_KEY,h); }
function currentHash(){ return localStorage.getItem(HASH_KEY); }
async function checkOnLoad(){
  try{
    const {content_hash} = await readVersionNoStore();
    if(!currentHash()) rememberHash(content_hash);
  }catch(e){ console.warn('version check failed',e); }
}

let swRegistration = null;
// DEPRECATED: legacy SW update banner. Replaced by public/app/sw_update.js.
// Keeping function for compatibility with older calls; no-op to avoid double banners.
function showUpdateBanner(){ /* no-op: handled by sw_update.js */ }

const SETTINGS_KEY = 'quiz-options';
function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {};
    const q = new URLSearchParams(location.search).get('mode');
    if (q === 'multiple-choice' || q === 'free') {
      s.mode = q;
    }
    if (s.mode !== 'multiple-choice' && s.mode !== 'free') {
      s.mode = 'free';
    }
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
    return s;
  } catch {
    return {};
  }
}
export const settings = loadSettings();
function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

const TYPE_LABELS = {
  'title-game': 'title→game',
  'game-composer': 'game→composer',
  'title-composer': 'title→composer'
};

const DB_NAME = 'vgm-quiz';
const DB_VERSION = 2;
const PLAY_STORE = 'plays';
const ALIAS_STORE = 'alias_proposals';
const dbPromise = new Promise((resolve, reject) => {
  const req = indexedDB.open(DB_NAME, DB_VERSION);
  req.onupgradeneeded = () => {
    const db = req.result;
    if (!db.objectStoreNames.contains(PLAY_STORE)) {
      db.createObjectStore(PLAY_STORE, { autoIncrement: true });
    }
    if (!db.objectStoreNames.contains(ALIAS_STORE)) {
      db.createObjectStore(ALIAS_STORE, { autoIncrement: true });
    }
  };
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

function showView(id) {
  ['start-view', 'question-view', 'result-view', 'history-view'].forEach(v => {
    document.getElementById(v).style.display = id === v ? 'block' : 'none';
  });
}

function trackId(track) {
  if (track['track/id']) return track['track/id'];
  const str = `${track.title}|${track.game}|${track.composer}|${track.year}`;
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(31, h) + str.charCodeAt(i) | 0;
  }
  return h >>> 0;
}

async function recordPlay(rec) {
  const db = await dbPromise;
  const tx = db.transaction(PLAY_STORE, 'readwrite');
  tx.objectStore(PLAY_STORE).add({ ...rec, ts: Date.now() });
}

async function fetchHistory() {
  const db = await dbPromise;
  return new Promise((resolve, reject) => {
    const req = db.transaction(PLAY_STORE, 'readonly').objectStore(PLAY_STORE).getAll();
    req.onsuccess = () => {
      resolve(req.result.sort((a, b) => b.ts - a.ts).slice(0, 20));
    };
    req.onerror = () => reject(req.error);
  });
}

async function clearHistoryStore() {
  const db = await dbPromise;
  db.transaction(PLAY_STORE, 'readwrite').objectStore(PLAY_STORE).clear();
}

async function saveAliasProposal(cat, canon, alias) {
  const db = await dbPromise;
  const tx = db.transaction(ALIAS_STORE, 'readwrite');
  tx.objectStore(ALIAS_STORE).add({ cat, canon, alias });
}

async function getAllAliasProposals() {
  const db = await dbPromise;
  return new Promise((resolve, reject) => {
    const req = db.transaction(ALIAS_STORE, 'readonly').objectStore(ALIAS_STORE).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function proposalsToEdn(data) {
  const catStrs = Object.entries(data).map(([cat, m]) => {
    const entries = Object.entries(m).map(([canon, list]) => {
      const aliases = list.map(a => `"${a.replace(/"/g, '\\"')}"`).join(' ');
      return `"${canon.replace(/"/g, '\\"')}" #{${aliases}}`;
    }).join(', ');
    return `:${cat} {${entries}}`;
  }).join(' ');
  return `{${catStrs}}`;
}

async function exportAliasProposals() {
  const items = await getAllAliasProposals();
  const merged = { game: {}, composer: {} };
  items.forEach(p => {
    const m = merged[p.cat];
    (m[p.canon] ||= new Set()).add(p.alias);
  });
  const formatted = { game: {}, composer: {} };
  Object.entries(merged).forEach(([cat, m]) => {
    Object.entries(m).forEach(([canon, set]) => {
      (formatted[cat][canon] ||= []).push(...set);
    });
  });
  const edn = proposalsToEdn(formatted);
  const blob = new Blob([edn], { type: 'application/edn' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'alias-proposals.edn';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export {
  readVersionNoStore,
  rememberHash,
  currentHash,
  checkOnLoad,
  showUpdateBanner,
  saveSettings,
  TYPE_LABELS,
  recordPlay,
  fetchHistory,
  clearHistoryStore,
  saveAliasProposal,
  exportAliasProposals,
  showView,
  trackId
};
