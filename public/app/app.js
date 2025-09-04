// i18n baseline (v1.6)
import { initI18n, whenI18nReady, applyStaticLabels } from './i18n.mjs';
void initI18n(); // non-blocking; updates <html lang> & document.title
whenI18nReady().then(() => {
  // Try immediately, then after first paint, then once again after 500ms for safety
  try { applyStaticLabels(); } catch {}
  try { requestAnimationFrame(() => applyStaticLabels()); } catch {}
  setTimeout(() => { try { applyStaticLabels(); } catch {} }, 500);
});
// Re-apply on language change (future-proofing)
window.addEventListener('i18n:changed', () => {
  try { applyStaticLabels(); } catch {}
});

// --- perf helpers ---
async function parseJsonOffMainThread(text) {
  try {
    // Use a dedicated worker to avoid blocking main thread with JSON.parse
    const url = new URL('./workers/json_parse_worker.js', import.meta.url);
    const worker = new Worker(url, { type: 'module' });
    return await new Promise((resolve, reject) => {
      const timer = setTimeout(() => { try { worker.terminate(); } catch (_) {} ; reject(new Error('parse timeout')); }, 15000);
      worker.onmessage = (ev) => {
        clearTimeout(timer);
        try { worker.terminate(); } catch (_) {}
        const { ok, data, error } = ev.data || {};
        if (ok) resolve(data);
        else reject(new Error(error || 'parse failed'));
      };
      worker.onerror = (e) => { clearTimeout(timer); try { worker.terminate(); } catch (_) {} ; reject(e); };
      worker.postMessage(text);
    });
  } catch (e) {
    // Fallback: parse on main thread
    return JSON.parse(text);
  }
}
async function yieldToMain() {
  return new Promise(requestAnimationFrame);
}
let aliasesLoadStarted = false;
let aliasesReadyPromise = null;
function ensureAliases() {
  if (!aliasesLoadStarted) {
    aliasesLoadStarted = true;
    try {
      aliasesReadyPromise = loadAliases();
    } catch (e) {
      console.warn('[aliases] ensure load failed', e);
      aliasesReadyPromise = Promise.resolve();
    }
  }
  return aliasesReadyPromise || Promise.resolve();
}
import { normalize as normalizeV2 } from './normalize.mjs';
import { orderByYearBucket } from './question_pipeline.mjs';
// lazy import on demand from './media_player.mjs'

let tracks = [];
let questions = [];
// パイプライン用の乱数。既定は Math.random（seed 初期化後に差し替える）
// フォールバックとして、常に window.__rng は function にしておく（デバッグ容易化）
if (typeof window.__rng !== 'function') {
  // Math.random の現在値を束縛（後で seed 初期化が走れば上書き）
  window.__rng = Math.random.bind(Math);
}
let rngForPipeline = window.__rng;
let MAX_LIVES = 3; // 既定値（?lives=on などで上書き可）
let mistakes = 0;
let __livesInterval = null;
const LIVES = { enabled: false, limit: 3, triggered: false };
let current = 0;
let score = 0;
let awaitingNext = false;
let currentRunId = null;
let datasetLoaded = false;
let datasetPromise = null;
const aliases = {};
let questionMode = 'free'; // multiple choice mode uses 'multiple-choice'
let timerId = null;
let remaining = 20;
let useTimer = false;
const scriptTag = document.currentScript;
window.__APP_VERSION__ = scriptTag?.dataset?.version || 'dev';
window.__DATASET_VERSION__ = null;

const VERSION_URL = '../build/version.json';
const DATASET_URL = '../build/dataset.json';
const ALIASES_URL = '../build/aliases.json';
const HASH_KEY = 'dataset_hash';

// TEST MODE: URL に ?test=1 が付いていたら Service Worker を無効化
const __SEARCH_PARAMS__ = new URLSearchParams(location.search);
const __IS_TEST_MODE__ = __SEARCH_PARAMS__.get('test') === '1';
const __DEBUG__ = __SEARCH_PARAMS__.get('debug') === '1';

// URLクエリのbool取得（既存があればそれを使用、なければ補助）
function getQueryBool(key) {
  try {
    const v = new URLSearchParams(location.search).get(key);
    return v === '1' || v === 'true';
  } catch { return false; }
}

// DETERMINISTIC RNG: URL に ?seed=xxx があれば Math.random を決定化
function initSeededRandom() {
  const seedParam = __SEARCH_PARAMS__.get('seed');
  if (!seedParam) return;
  // xfnv1a + mulberry32 の組み合わせで決定的 PRNG を作る
  function xfnv1a(str) {
    // 32-bit FNV-1a
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return h >>> 0;
  }
  function mulberry32(a) {
    return function () {
      let t = (a += 0x6D2B79F5) >>> 0;
      t = Math.imul(t ^ (t >>> 15), t | 1) >>> 0;
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const seedInt = xfnv1a(String(seedParam));
  const rng = mulberry32(seedInt);
  const origRandom = window.__ORIG_RANDOM__ || Math.random;
  Object.defineProperty(Math, 'random', {
    value: rng,
    configurable: true,
    writable: true,
  });
  // 先に公開しておく（以後のログや例外があっても __rng が常に function になる）
  window.__SEED__ = window.__SEED__ ?? seedParam;
  window.__SEED_INT__ = window.__SEED_INT__ ?? seedInt;
  window.__rng = rng;
  rngForPipeline = rng;
  try { console.info('[SEED]', seedParam, seedInt); } catch (_) {}
  window.__ORIG_RANDOM__ = origRandom;
}

initSeededRandom();

// ---------------------
// Daily 1-question mode
// ---------------------
const DAILY = {
  active: false,
  dateStr: null,        // 'YYYY-MM-DD'
  wanted: null,         // { id?: string, title?: string }
  mapLoaded: false,
};

function getQueryParam(name) {
  try { return new URLSearchParams(location.search).get(name); }
  catch { return null; }
}

function todayJST() {
  // 'YYYY-MM-DD' を JST で作る
  const fmt = new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' });
  const [{value: y}, , {value: m}, , {value: d}] = fmt.formatToParts(new Date());
  return `${y}-${m}-${d}`;
}

function detectDailyParam() {
  const v = getQueryParam('daily');
  if (!v) return null;
  if (v === '1' || v === 'true') return todayJST();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  return null;
}

async function preloadDailyMap() {
  try {
    const res = await fetch('./daily.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`daily.json ${res.status}`);
    const data = await res.json();
    DAILY.map = data?.map || {};
    DAILY.mapLoaded = true;
  } catch (e) {
    console.warn('[daily] failed to load daily.json:', e);
    DAILY.map = {};
    DAILY.mapLoaded = true;
  }
}

function initDaily() {
  const date = detectDailyParam();
  if (!date) return;
  DAILY.active = true;
  DAILY.dateStr = date;
}

// タイトル/IDの正規化一致
function normKey(s) { return normalizeV2(String(s || '')); }
function pickDailyWantedFromMap() {
  if (!DAILY.active) return;
  const entry = DAILY.map?.[DAILY.dateStr];
  if (!entry) return;
  if (typeof entry === 'string') {
    DAILY.wanted = { id: entry }; // 旧式：そのままID扱い
  } else if (entry && typeof entry === 'object') {
    DAILY.wanted = { id: entry.id, title: entry.title };
  }
}

// 質問配列を 1 問に絞る（可能なら該当トラックを優先）
function applyDailyRestriction() {
  if (!DAILY.active || !Array.isArray(questions) || questions.length === 0) return;
  // 優先順位: ID → タイトル（正規化一致）
  let idx = -1;
  if (DAILY.wanted?.id) {
    const target = normKey(DAILY.wanted.id);
    idx = questions.findIndex(q => normKey(q?.track?.id) === target);
  }
  if (idx < 0 && DAILY.wanted?.title) {
    const target = normKey(DAILY.wanted.title);
    idx = questions.findIndex(q => normKey(q?.track?.title) === target);
  }
  if (idx < 0) idx = 0; // フォールバック
  questions = [questions[idx]];
}

// === バージョン読み取りのメモ化（60s TTL） ========================
const VERSION_TTL_MS = 60_000;
const VERSION_TIMEOUT_MS = 8_000; // 8s に延長
let __readVersionCache = { ts: 0, data: null, etag: null };
let __readVersionInflight = null;  // ★ in-flight共有

async function readVersionNoStore(force = false) {
  // 1) in-flight共有
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
async function applyUpdateAndReload(){
  try{
    const {content_hash} = await readVersionNoStore();
    rememberHash(content_hash);
  }catch(_){ }
  location.reload();
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
const settings = loadSettings();
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

function norm(str) {
  // v1.1: 強化版ノーマライズ（normalize.mjs）へ委譲。失敗時は従来フォールバック。
  try { return normalizeV2(String(str)); }
  catch (_) { return String(str ?? '').normalize('NFKC').trim().toLowerCase(); }
}

function canonical(str) {
  const n = norm(str);
  return aliases[n] || n;
}

// 質問配列が作られた直後（既存ロジックの直後）で並べ替えを適用
// 例：buildQuestions() / startGame() の直後など、questions が最終確定した箇所にフック
function afterQuestionsBuiltHook() {
  try {
    // (1) 出題順の分散（フラグ qp=1 のとき）
    if (getQueryBool('qp') && Array.isArray(questions) && questions.length > 0) {
      // v0.2: ここで明示的に seed RNG を使う（フォールバックは rngForPipeline 側で済）
      const order = orderByYearBucket(questions, rngForPipeline);
      questions = order.map(i => questions[i]);
    }
    // (2) デイリー1問（フラグ daily=... のとき）
    if (DAILY.active) {
      if (!DAILY.mapLoaded) {
        // 先読み未完の場合は同期的に見えるところで諦め、次回以降に反映（安全策）
        console.warn('[daily] map not loaded yet; using fallback (first question)');
        questions = [questions[0]];
      } else {
        pickDailyWantedFromMap();
        applyDailyRestriction();
      }
    }
    // (3) test=1 のときデバッグ公開
    if (getQueryBool('test') && Array.isArray(questions)) {
      window.__questionIds = questions.map(q => q?.track?.id ?? q?.track?.title ?? '').join(',');
      window.__questionDebug = questions.map(q => ({
        title: q?.track?.title ?? '',
        year: q?.track?.year ?? null,
        type: q?.type ?? '',
      }));
    }
  } catch (_) {}
}

// --- lives（残機）: 誤答数をHUDに反映 ---
function updateLivesDisplay() {
  const el = document.getElementById('lives') || document.querySelector('[data-testid="lives"]');
  if (!el) return;
  // A11y: role/status として polite に更新
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.setAttribute('aria-atomic', 'true');
  const lim = LIVES.enabled ? LIVES.limit : MAX_LIVES;
  el.textContent = `Misses: ${mistakes}/${lim}`;
}

function recomputeMistakes() {
  try {
    // 既に回答済みの設問から誤答をカウント
    // （構造: q.correct が boolean / userAnswer が入るのを想定）
    mistakes = (questions || []).filter(q => q && q.userAnswer != null && q.correct === false).length;
  } catch (_) {
    // フォールバック（何もしない）
  }
  updateLivesDisplay();
  maybeEndGameByLives();
}

function startLivesTicker() {
  stopLivesTicker();
  // 次の問題表示や手動/自動の遷移に追随するため、軽い定期更新
  __livesInterval = setInterval(recomputeMistakes, 400);
  // 開始時に即時1回
  recomputeMistakes();
}

function stopLivesTicker() {
  if (__livesInterval) {
    clearInterval(__livesInterval);
    __livesInterval = null;
  }
}

// moved to ./fuzzy.mjs (lazy-imported on demand)

function yearBucket(y) {
  const yr = parseInt(y, 10) || 0;
  return yr - (yr % 5);
}

function distinctBy(keys, arr) {
  const seen = new Set();
  return arr.filter(item => {
    const k = keys.map(key => item[key]).join('|');
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function spreadByBucket(items, bucketFn, n) {
  const buckets = {};
  items.forEach(item => {
    const b = bucketFn(item);
    (buckets[b] ||= []).push(item);
  });
  const bucketKeys = Object.keys(buckets).sort(() => Math.random() - 0.5);
  bucketKeys.forEach(k => buckets[k].sort(() => Math.random() - 0.5));
  const result = [];
  while (result.length < n) {
    let added = false;
    for (const key of bucketKeys) {
      const bucket = buckets[key];
      if (bucket.length) {
        result.push(bucket.pop());
        added = true;
        if (result.length === n) break;
      }
    }
    if (!added) break;
  }
  return result;
}

function selectedTypes() {
  return Array.from(document.querySelectorAll('input[name="qtype"]:checked')).map(cb => cb.value);
}

function updateStartButton() {
  const disabled = !datasetLoaded || selectedTypes().length === 0;
  document.getElementById('start-btn').disabled = disabled;
  const btn = document.getElementById('export-minhaya-btn');
  if (btn) btn.disabled = disabled;
}

async function loadDataset() {
  try {
    // TEST/Mock: URL に ?mock=1 があれば軽量データセットを使用
    let datasetUrl = DATASET_URL;
    const mock = __SEARCH_PARAMS__.get('mock') === '1';
    if (mock) {
      datasetUrl = './mock/dataset.json';
      try { console.info('[MOCK_DATASET] using', datasetUrl); } catch (_) {}
    }
    const res = await fetch(datasetUrl, { cache: 'no-store' });
    const txt = await res.text();
    const data = await parseJsonOffMainThread(txt);
    tracks = data.tracks || data; // 互換
    datasetLoaded = true;
    updateStartButton();
  } catch (err) {
    console.error('Failed to load dataset', err);
    const msg = document.getElementById('dataset-error');
    if (msg) {
      msg.textContent = 'データが読み込めませんでした。時間をおいて再度お試しください。';
      msg.style.display = 'block';
    }
  }
}

async function loadAliases() {
  try {
    const res = await fetch(ALIASES_URL, { cache: 'no-store' });
    if (res.ok) {
      const txt = await res.text();
      const data = await parseJsonOffMainThread(txt);
      let _count = 0;
      for (const cat of Object.values(data)) {
        for (const [canon, list] of Object.entries(cat)) {
          const canonN = norm(canon);
          aliases[canonN] = canonN;
          for (const a of list) {
            aliases[norm(a)] = canonN;
            _count++;
            if ((_count % 400) === 0) {
              await yieldToMain();
            }
          }
        }
        // yield between categories, too
        await yieldToMain();
      }
    }
    try {
      const r2 = await fetch('./aliases_local.json', { cache: 'no-store' });
      if (r2.ok) {
        const local = await r2.json();
        Object.entries(local).forEach(([k, v]) => { aliases[k] = v; });
      }
    } catch (_) {}
  } catch (err) {
    console.warn('Failed to load aliases', err);
  }
}

function shortCommit(s) {
  if (!s) return 'local';
  s = String(s);
  // 40桁SHAは7桁に、長い文字列も安全側で7桁に短縮
  if (/^[0-9a-f]{40}$/i.test(s)) return s.slice(0, 7);
  return s.length > 12 ? s.slice(0, 7) : s;
}

function fmtYmdHm(ts) {
  try {
    const d = new Date(ts);
    if (isNaN(d)) return null;
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch (_) {
    return null;
  }
}

async function loadVersion() {
  const el =
    document.getElementById('version') ||
    document.querySelector('#footer-version, footer .version');
  const setText = (t) => { if (el) el.textContent = t; };

  try {
    // 必ず readVersionNoStore() を経由（60s TTL / in-flight共有 / 8s timeout）
    const v = await readVersionNoStore(false);

    // dataset候補を総当り（数値なら vN、文字ならそのまま、無ければ content_hash 先頭8）
    const dsRaw = v.dataset_version ?? v.dataset ?? v.data?.dataset ?? v.name ?? v.title;
    let ds = (typeof dsRaw === 'number') ? `v${dsRaw}`
           : (typeof dsRaw === 'string' && dsRaw.trim()) ? dsRaw.trim()
           : (v.content_hash ? String(v.content_hash).slice(0, 8) : 'unknown');

    // commit は各種キーから拾って7桁短縮
    const commit = shortCommit(
      v.commit ?? v.git_commit ?? v.sha ?? v.revision
    );

    // 代表的な日時キーを許容
    const updated = fmtYmdHm(
      v.generated_at ?? v.updated_at ?? v.date ?? v.timestamp
    );

    const text = updated
      ? `Dataset: ${ds} • commit: ${commit} • updated: ${updated}`
      : `Dataset: ${ds} • commit: ${commit}`;
    setText(text);
  } catch (e) {
    setText && setText('Dataset: unknown • commit: local');
    console.warn('[version] load failed:', e);
  }
}

// SWなどから明示的に更新を促したい場合のフック（強制再取得）
window.loadVersionForce = async () => {
  try { await readVersionNoStore(true); } catch (_) {}
  try { await loadVersion(); } catch (_) {}
};

// デバッグ/検証用：TTL/in-flight 共有の“通常経路”を叩くための公開フック
if (typeof window.loadVersionPublic !== 'function') {
  window.loadVersionPublic = async () => {
    try { await readVersionNoStore(false); } catch (_) {}
    try { await loadVersion(); } catch (_) {}
  };
}

// （任意）キャッシュの中身を覗く/クリアする簡易デバッグ
window.versionDebug = {
  stats: () => ({ ttlMs: 60000, cache: __readVersionCache }),
  clear: () => { __readVersionCache = { ts: 0, data: null, etag: null }; }
};

// 二重実行防止の once 付き
document.addEventListener('DOMContentLoaded', loadVersion, { once: true });

function escapeCsv(str) {
  return '"' + String(str).replace(/"/g, '""') + '"';
}

function toMinhayaCsv(items) {
  const rows = items.map(it => `${escapeCsv(it.question)},${escapeCsv(it.answer)},${escapeCsv(it.explanation || '')}`);
  return `question,answer,explanation\n${rows.join('\n')}`;
}

async function exportMinhaya() {
  const countSelect = document.getElementById('count');
  let n = parseInt(countSelect.value, 10) || 5;
  await yieldToMain();
  const deduped = distinctBy(['title', 'game', 'composer'], tracks);
  n = Math.min(n, deduped.length);
  const selected = spreadByBucket(deduped, t => yearBucket(t.year), n);
  const types = selectedTypes();
  const items = selected.map(track => {
    const type = types[Math.floor(Math.random() * types.length)];
    switch (type) {
      case 'title-game':
        return { question: `この曲の収録作品は？: ${track.title}`,
                 answer: track.game,
                 explanation: `${track.year} / ${track.composer}` };
      case 'game-composer':
        return { question: `この作品の作曲者は？: ${track.game}`,
                 answer: track.composer,
                 explanation: `${track.year}` };
      case 'title-composer':
        return { question: `この曲の作曲者は？: ${track.title}`,
                 answer: track.composer,
                 explanation: `${track.year} / ${track.game}` };
    }
  });
  const csv = toMinhayaCsv(items);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'minhaya.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function startQuiz() {
  // non-blocking: load aliases in background; canonical() falls back to norm() until ready
  ensureAliases().catch(e => console.warn('[aliases] deferred load error', e));
  initSeededRandom();
  currentRunId = Date.now();
  const modeSelect = document.getElementById('mode');
  questionMode = modeSelect.value;
  useTimer = document.getElementById('timer20').checked;
  settings.mode = questionMode;
  saveSettings();
  const countSelect = document.getElementById('count');
  let n = parseInt(countSelect.value, 10) || 5;
  await yieldToMain();
  const deduped = distinctBy(['title', 'game', 'composer'], tracks);
  n = Math.min(n, deduped.length);
  const candidates = spreadByBucket(deduped, t => yearBucket(t.year), deduped.length);
  const types = selectedTypes();
  const built = [];
  const maxAttempts = n * 10;
  let attempts = 0;
  while (built.length < n && attempts < maxAttempts && candidates.length) {
    // yield periodically to avoid long tasks during question build
    if ((attempts % 5) === 0) { await yieldToMain(); }

    const track = candidates.pop();
    attempts++;
    const type = types[Math.floor(Math.random() * types.length)];
    if (questionMode === 'multiple-choice') {
      const opts = generateChoices(track, type, tracks, canonical);
      const canon = new Set(opts.map(o => canonical(o)));
      if (opts.length < 4 || canon.size < 4) {
        if (__DEBUG__) console.info('[DEBUG] skip', trackId(track), 'opts', opts);
        continue;
      }
      built.push({ track, type, options: opts.sort(() => Math.random() - 0.5) });
      if (__DEBUG__) console.info('[DEBUG] add', trackId(track), type);
    } else {
      built.push({ track, type });
      if (__DEBUG__) console.info('[DEBUG] add', trackId(track), type);
    }
  }
  if (built.length < n) {
    console.warn(`question build shortfall: ${built.length}/${n} after ${attempts} attempts`);
    if (__DEBUG__) {
      const reason = attempts >= maxAttempts ? 'maxAttempts' : 'candidates_exhausted';
      console.info('[DEBUG] attempts', attempts, 'max', maxAttempts, 'reason', reason);
    }
  } else if (__DEBUG__) {
    console.info('[DEBUG] attempts', attempts);
  }
  questions = built;
  afterQuestionsBuiltHook();
  current = 0;
  score = 0;
  showQuestion();
}

function showQuestion() {
  awaitingNext = false;
  showView('question-view');
  // media reset
  try { document.getElementById('media-slot')?.replaceChildren(); } catch (_) {}
  // test=1 時はデバッグ情報を常に同期しておく（冪等）
  try {
    if (getQueryBool('test') && Array.isArray(questions)) {
      window.__questionIds = questions.map(q => q?.track?.id ?? q?.track?.title ?? '').join(',');
      window.__questionDebug = questions.map(q => ({
        title: q?.track?.title ?? '',
        year: q?.track?.year ?? null,
        type: q?.type ?? '',
      }));
    }
  } catch (_) {}
  const q = questions[current];
  const prompt = document.getElementById('prompt');
  const answer = document.getElementById('answer');
  const submit = document.getElementById('submit-btn');
  const next = document.getElementById('next-btn');
  const feedback = document.getElementById('feedback');
  const scoreBar = document.getElementById('score-bar');
  const aliasBtn = document.getElementById('propose-alias-btn');
  const choices = document.getElementById('choices');
  const countdown = document.getElementById('countdown');
  // --- v: メディア（任意） ---
  try {
    const media = q?.media || q?.track?.media;
    const slot = document.getElementById('media-slot');
    if (slot && media) {
      import('./media_player.mjs').then(({ createMediaControl }) => {
        try {
          const ctrl = createMediaControl(media);
          slot.replaceChildren(ctrl);
        } catch (e) { console.warn('[media] render failed', e); }
      }).catch(e => console.warn('[media] lazy load failed', e));
    }
  } catch (_) {}
  clearInterval(timerId);
  remaining = 20;
  answer.value = '';
  answer.focus();
  feedback.textContent = '';
  submit.disabled = false;
  next.style.display = 'none';
  aliasBtn.style.display = 'none';
  aliasBtn.disabled = false;
  aliasBtn.textContent = '別名として提案';
  aliasBtn.onclick = null;
  scoreBar.textContent = `Score: ${score}/${questions.length}`;
  const choiceButtons = choices.querySelectorAll('button.choice');
  if (questionMode === 'multiple-choice') {
    answer.style.display = 'none';
    submit.style.display = 'none';
    const opts = q.options || generateChoices(q.track, q.type, tracks, canonical).sort(() => Math.random() - 0.5);
    q.options = opts;
    choiceButtons.forEach((btn, idx) => {
      const opt = opts[idx];
      btn.textContent = opt;
      btn.disabled = false;
      btn.onclick = () => {
        answer.value = opt;
        submitAnswer();
      };
    });
    choices.style.display = 'block';
  } else {
    answer.style.display = 'inline';
    submit.style.display = 'inline';
    choices.style.display = 'none';
  }
  switch (q.type) {
    case 'title-game':
      prompt.textContent = `Which game is the track "${q.track.title}" from?`;
      q.expected = q.track.game;
      break;
    case 'game-composer':
      prompt.textContent = `Who composed the music for "${q.track.game}"?`;
      q.expected = q.track.composer;
      break;
    case 'title-composer':
      prompt.textContent = `Who composed the track "${q.track.title}"?`;
      q.expected = q.track.composer;
      break;
  }
  window.__expectedAnswer = q.expected;
  if (useTimer) {
    countdown.style.display = 'block';
    countdown.textContent = remaining;
    timerId = setInterval(() => {
      remaining--;
      countdown.textContent = remaining;
      if (remaining <= 0) {
        clearInterval(timerId);
        timerId = null;
        submitAnswer();
        nextQuestion();
      }
    }, 1000);
  } else {
    countdown.style.display = 'none';
  }
}

function showHint() {
  const q = questions[current];
  const feedback = document.getElementById('feedback');
  if (q.type === 'title-game') {
    feedback.textContent = `Hint: ${q.track.year}`;
  } else {
    feedback.textContent = `Hint: ${q.expected[0]}`;
  }
}

function submitAnswer() {
  const q = questions[current];
  const promptText = document.getElementById('prompt').textContent;
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
  const rawInput = document.getElementById('answer').value;
  const userAns = canonical(rawInput);
  const expected = canonical(q.expected);
  const feedback = document.getElementById('feedback');
  const scoreBar = document.getElementById('score-bar');
  const correct = userAns === expected;
  const aliasBtn = document.getElementById('propose-alias-btn');
  q.elapsed = 20 - remaining;
  document.querySelectorAll('#choices button').forEach(b => b.disabled = true);
  aliasBtn.style.display = 'none';
  if (correct) {
    score++;
    feedback.textContent = 'Correct!';
  } else {
    feedback.textContent = `Incorrect. Correct: ${q.expected}`;
    // lazy-load fuzzy distance to avoid boot-time parse/compile
    import('./fuzzy.mjs').then(module => {
      const dist = module.levenshtein(norm(rawInput), norm(q.expected));
      if (dist > 0 && dist <= 2) {
        aliasBtn.style.display = 'inline';
        aliasBtn.disabled = false;
        aliasBtn.textContent = '別名として提案';
        aliasBtn.onclick = () => {
          const cat = q.type === 'title-game' ? 'game' : 'composer';
          saveAliasProposal(cat, expected, norm(rawInput));
          aliasBtn.textContent = '提案を保存しました';
          aliasBtn.disabled = true;
        };
      }
    }).catch(() => { /* ignore */ });
  }
  q.userAnswer = rawInput;
  q.correct = correct;
  recordPlay({
    runId: currentRunId,
    trackId: trackId(q.track),
    prompt: promptText,
    expected: q.expected,
    userAnswer: rawInput,
    correct
  });
  scoreBar.textContent = `Score: ${score}/${questions.length}`;
  const submit = document.getElementById('submit-btn');
  const next = document.getElementById('next-btn');
  submit.disabled = true;
  next.style.display = 'inline';
  awaitingNext = true;
}

function nextQuestion() {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
  current++;
  if (current >= questions.length) {
    showResult();
  } else {
    showQuestion();
  }
}

function showResult() {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
  showView('result-view');
  document.getElementById('final-score').textContent = `Score: ${score}/${questions.length}`;
  // 結果画面では定期更新を停止し、最終値を表示
  stopLivesTicker();
  recomputeMistakes();
  const list = document.getElementById('summary-list');
  list.innerHTML = '';
  questions.forEach(q => {
    const li = document.createElement('li');
    li.textContent = `${TYPE_LABELS[q.type]} - ${q.correct ? '✅' : '❌'} - ${q.expected} - ${q.userAnswer || ''} - ${q.track.year} - ${q.track.game} - ${q.elapsed}s`;
    list.appendChild(li);
  });

  // v2: 結果の共有導線（コピー／Share）をセットアップ
  setupResultShare();
  // （必要ならここで LIVES.triggered は true のままでOK）
  // v2.1: 終了ダイアログのA11y制御（初期フォーカス / Tabトラップ / Escで閉じる）
  openResultDialogA11y();
}

// --- Share helpers (結果画面専用) ---
function canonicalAppUrl() {
  // 現在の URL から検証用クエリを取り除いた共有用URLを返す
  try {
    const u = new URL(location.href);
    const rm = ['test','mock','autostart','lhci','debug'];
    rm.forEach(k => u.searchParams.delete(k));
    return u.toString();
  } catch {
    return location.origin + location.pathname;
  }
}

function buildResultShareText() {
  const total = questions.length || 0;
  const correct = score || 0;
  const acc = total ? Math.round((correct / total) * 100) : 0;
  const types = selectedTypes().map(t => TYPE_LABELS[t] || t).join(', ');
  const mode = (questionMode === 'multiple-choice') ? '4択' : '自由入力';
  const seed = window.__SEED__ || new URLSearchParams(location.search).get('seed') || '';
  const timer = useTimer ? '20s' : 'off';
  const url = canonicalAppUrl();
  return [
    'VGM Quiz',
    `Score: ${correct}/${total} (${acc}%)`,
    `Mode: ${mode}${seed ? ` | seed: ${seed}` : ''} | Timer: ${timer}`,
    `Types: ${types}`,
    `Play: ${url}`
  ].join('\n');
}

let _copyToastTimer = null;
async function copyToClipboard(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    const toast = document.getElementById('copy-toast');
    if (toast) {
      toast.textContent = 'コピーしました';
      toast.setAttribute('aria-live', 'polite');
      // 数秒で自動クリア（多重クリックにも対応）
      if (_copyToastTimer) clearTimeout(_copyToastTimer);
      _copyToastTimer = setTimeout(() => {
        toast.textContent = '';
        _copyToastTimer = null;
      }, 2000);
    }
  } catch (e) {
    alert('コピーに失敗しました: ' + e.message);
  }
}

function setupResultShare() {
  const copyBtn = document.getElementById('copy-result-btn');
  const shareBtn = document.getElementById('share-result-btn');
  const toast = document.getElementById('copy-toast');
  if (toast) toast.textContent = ''; // 直前の表示をリセット
  if (!copyBtn || !shareBtn) return;
  if (!copyBtn.dataset._bound) {
    copyBtn.addEventListener('click', async () => {
      await copyToClipboard(buildResultShareText());
    }, { passive: true });
    copyBtn.dataset._bound = '1';
  }
  // Web Share API がある環境だけ Share を出す
  if (typeof navigator.share === 'function') {
    shareBtn.style.display = '';
    if (!shareBtn.dataset._bound) {
      shareBtn.addEventListener('click', async () => {
        const text = buildResultShareText();
        try { await navigator.share({ title: 'VGM Quiz', text, url: canonicalAppUrl() }); }
        catch (e) {
          // キャンセル等は無視。それ以外はコピーにフォールバック
          if (e && e.name !== 'AbortError') await copyToClipboard(text);
        }
      }, { passive: true });
      shareBtn.dataset._bound = '1';
    }
  } else {
    shareBtn.style.display = 'none';
  }
}

// --- Result dialog A11y: focus trap / initial focus / ESC close ---
let _resultDialogPrevFocus = null;
let _resultDialogKeydown = null;
function focusablesIn(node) {
  const sel = [
    'a[href]', 'button:not([disabled])', 'input:not([disabled])',
    'select:not([disabled])', 'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(',');
  return Array.from(node.querySelectorAll(sel)).filter(el => {
    const s = getComputedStyle(el);
    return s.visibility !== 'hidden' && s.display !== 'none';
  });
}
function openResultDialogA11y() {
  const dlg = document.getElementById('result-view');
  if (!dlg) return;
  // 保存：開く前のフォーカス
  _resultDialogPrevFocus = document.activeElement;
  // 初期フォーカス（コピー > 共有 > リスタート の優先）
  const first =
    document.getElementById('copy-result-btn') ||
    document.getElementById('share-result-btn') ||
    document.getElementById('restart-btn') ||
    dlg;
  first.focus();
  // ---- a11y hardening: background inert + scroll lock ----
  try {
    const main = document.getElementById('main') || dlg.parentElement;
    if (main) {
      Array.from(main.children).forEach((el) => {
        if (el !== dlg) {
          el.setAttribute('aria-hidden', 'true');
          // inert prevents focus & events on background; supported in Chromium, Safari
          // (attribute form is fine; property may not exist in older engines)
          el.setAttribute('inert', '');
        }
      });
      // mark for cleanup
      dlg.dataset._a11yInertApplied = '1';
    }
    // Prevent background scroll while modal is open
    document.documentElement.classList.add('modal-open');
    document.body && (document.body.style.overflow = 'hidden');
  } catch (_) {}
  // Tabトラップ
  _resultDialogKeydown = (ev) => {
    if (ev.key === 'Tab') {
      const list = focusablesIn(dlg);
      if (!list.length) return;
      const first = list[0], last = list[list.length - 1];
      if (ev.shiftKey && document.activeElement === first) {
        last.focus(); ev.preventDefault();
      } else if (!ev.shiftKey && document.activeElement === last) {
        first.focus(); ev.preventDefault();
      }
    } else if (ev.key === 'Escape' || ev.key === 'Esc') {
      // Escで結果を閉じて Start に戻す（安全に戻れない場合はフォーカスだけ返す）
      closeResultDialogA11y(true);
    }
  };
  dlg.addEventListener('keydown', _resultDialogKeydown);
  // 念のため属性を強化
  dlg.setAttribute('aria-modal', 'true');
  dlg.setAttribute('role', 'dialog');
  dlg.setAttribute('tabindex', '-1');
}
function closeResultDialogA11y(goStart = false) {
  const dlg = document.getElementById('result-view');
  if (dlg && _resultDialogKeydown) {
    dlg.removeEventListener('keydown', _resultDialogKeydown);
  }
  _resultDialogKeydown = null;
  // ---- a11y hardening cleanup: remove inert/aria-hidden & unlock scroll ----
  try {
    if (dlg && dlg.dataset._a11yInertApplied) {
      const main = document.getElementById('main') || dlg.parentElement;
      if (main) {
        Array.from(main.children).forEach((el) => {
          if (el !== dlg) {
            el.removeAttribute('aria-hidden');
            el.removeAttribute('inert');
          }
        });
      }
      delete dlg.dataset._a11yInertApplied;
    }
    document.documentElement.classList.remove('modal-open');
    document.body && (document.body.style.overflow = '');
  } catch (_) {}
  // 戻り先：Startビュー or 直前フォーカス
  if (goStart) {
    try {
      showView('start-view');
      const sb = document.getElementById('start-btn') || document.querySelector('[data-testid="start-btn"]');
      sb?.focus();
      return;
    } catch (_) {}
  }
  if (_resultDialogPrevFocus && _resultDialogPrevFocus.focus) {
    _resultDialogPrevFocus.focus();
  }
  _resultDialogPrevFocus = null;
}

// Restartボタンで閉じるときもフォーカスを安全に処理
(() => {
  const bind = () => {
    const r = document.getElementById('restart-btn');
    if (r && !r.dataset._a11yBound) {
      r.addEventListener('click', () => closeResultDialogA11y(false), { passive: true });
      r.dataset._a11yBound = '1';
    }
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind, { once: true });
  } else {
    bind();
  }
})();

function restart() {
  showView('start-view');
}

async function showHistory() {
  const list = document.getElementById('history-list');
  list.innerHTML = '';
  const items = await fetchHistory();
  let latestRunId = items.find(p => p.runId)?.runId;
  const filtered = latestRunId ? items.filter(p => p.runId === latestRunId) : items;
  filtered.forEach(p => {
    const li = document.createElement('li');
    const ts = new Date(p.ts).toLocaleString();
    li.textContent = `${ts} - ${p.prompt} - ${p.userAnswer} - ${p.correct ? '✅' : '❌'}`;
    list.appendChild(li);
  });
  showView('history-view');
}

async function clearHistory() {
  await clearHistoryStore();
  showHistory();
}

document.getElementById('start-btn').addEventListener('click', startQuiz);
document.getElementById('submit-btn').addEventListener('click', submitAnswer);
document.getElementById('next-btn').addEventListener('click', nextQuestion);
document.getElementById('restart-btn').addEventListener('click', restart);
document.getElementById('history-btn').addEventListener('click', showHistory);
document.getElementById('history-back-btn').addEventListener('click', () => showView('start-view'));
document.getElementById('clear-history-btn').addEventListener('click', clearHistory);
document.getElementById('export-aliases-btn').addEventListener('click', exportAliasProposals);
const exportMinhayaBtn = document.createElement('button');
exportMinhayaBtn.id = 'export-minhaya-btn';
exportMinhayaBtn.textContent = 'Export for みんはや';
exportMinhayaBtn.addEventListener('click', exportMinhaya);
document.getElementById('start-view').appendChild(exportMinhayaBtn);
document.querySelectorAll('input[name="qtype"]').forEach(cb => {
  cb.addEventListener('change', () => {
    settings.types = selectedTypes();
    saveSettings();
    updateStartButton();
  });
});
const countEl = document.getElementById('count');
countEl.addEventListener('change', () => {
  settings.count = parseInt(countEl.value, 10);
  saveSettings();
});
const modeEl = document.getElementById('mode');
modeEl.addEventListener('change', () => {
  settings.mode = modeEl.value;
  saveSettings();
});
const autoEl = document.getElementById('auto-enabled');
if (autoEl) {
  // reflect saved state
  autoEl.checked = !!settings.auto_enabled;
  autoEl.addEventListener('change', () => {
    settings.auto_enabled = !!autoEl.checked;
    saveSettings();
  });
}

document.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    awaitingNext ? nextQuestion() : submitAnswer();
  } else if (e.key.toLowerCase() === 'n' && e.target.id !== 'answer' && awaitingNext) {
    nextQuestion();
  } else if (e.key.toLowerCase() === 'h' && e.target.id !== 'answer' && !awaitingNext) {
    showHint();
  }
});

if (settings.types) {
  document.querySelectorAll('input[name="qtype"]').forEach(cb => {
    cb.checked = settings.types.includes(cb.value);
  });
}
if (settings.count) {
  countEl.value = settings.count;
}
if (settings.mode) {
  modeEl.value = settings.mode;
  questionMode = settings.mode;
}
updateStartButton();

console.log('features', { mode: questionMode === 'multiple-choice' ? 'MC' : 'Free', timer: useTimer ? '20s' : 'off' });

checkOnLoad();
{
  const ric = window.requestIdleCallback || (cb => setTimeout(cb, 1));
  ric(() => { try { datasetPromise = loadDataset(); } catch(e){} });
  // [perf] defer aliases: load after Start button (startQuiz)
  // ric(() => { try { ensureAliases(); } catch(e){} });
}

navigator.serviceWorker?.addEventListener('message', async (e)=>{
  if(e.data?.type==='version-refreshed'){
    const {content_hash} = await readVersionNoStore(true);
    if(currentHash() !== content_hash){ showUpdateBanner(); }
  }
});
// ---------------------
// 起動時フック
// ---------------------
window.addEventListener('DOMContentLoaded', () => {
  try {
    // Lives ルールを起動時に解釈
    initLivesRule();
    // Daily 検出＆先読み開始
    initDaily();
    if (DAILY.active) { preloadDailyMap(); }
    // Start を押したらリセット
    const startBtn = document.getElementById('start-btn') || document.querySelector('[data-testid="start-btn"]');
    if (startBtn && !startBtn.dataset._livesbound) {
      startBtn.addEventListener('click', () => {
        mistakes = 0;
        LIVES.triggered = false;
        startLivesTicker();
      }, { passive: true });
      startBtn.dataset._livesbound = '1';
    }

    // Next（次の問題へ）で再集計
    document.addEventListener('click', (e) => {
      const t = e.target;
      const id = t && (t.id || t.getAttribute?.('data-testid')) || '';
      if (id === 'next-btn') {
        // DOM更新後に集計する
        setTimeout(recomputeMistakes, 0);
      }
    }, { passive: true });

    // 他の初期化があれば既存処理…
  } catch (_) {}
});

// --- Lives ルール: 3ミスで即終了（?lives=on または ?lives=3 等数値指定） ---
function initLivesRule() {
  const v = getQueryParam('lives');
  if (!v) { LIVES.enabled = false; LIVES.limit = MAX_LIVES; return; }
  if (v === 'on' || v === 'true') { LIVES.enabled = true; LIVES.limit = 3; MAX_LIVES = 3; return; }
  const n = parseInt(v, 10);
  if (Number.isFinite(n) && n > 0 && n <= 9) {
    LIVES.enabled = true;
    LIVES.limit = n;
    MAX_LIVES = n;
    return;
  }
  // デフォルト
  LIVES.enabled = true; LIVES.limit = 3; MAX_LIVES = 3;
}
function maybeEndGameByLives() {
  if (!LIVES.enabled || LIVES.triggered) return;
  if (mistakes >= LIVES.limit) {
    LIVES.triggered = true;
    try { stopLivesTicker(); } catch (_) {}
    // 可能なUI操作を止めて安全に結果へ
    try {
      document.querySelectorAll('#choices button,[data-testid="choice"],#submit-btn')
        .forEach(el => el.setAttribute('disabled', 'true'));
    } catch (_) {}
    showResult();
  }
}
// 初期化時に1回だけ実行（以降の呼び出しはガードで即return）
window.addEventListener('DOMContentLoaded', () => {
  if ('serviceWorker' in navigator) {
    const v = window.__APP_VERSION__ || 'dev';
    if (__IS_TEST_MODE__) {
      // E2E / CI 用。SW は登録しない
    } else {
      navigator.serviceWorker.register(`./sw.js?v=${encodeURIComponent(v)}`).then(reg => {
        swRegistration = reg;
        try { window.dispatchEvent(new CustomEvent('sw-registered', { detail: swRegistration })); } catch (_) {}
        if (swRegistration.waiting) {
          showUpdateBanner();
        }
        swRegistration.addEventListener('updatefound', () => {
          const newWorker = swRegistration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (swRegistration.waiting) {
                showUpdateBanner();
              }
            });
          }
        });
      });
    }
  }
});
// --- A11y: focus/roles/progressbar（視覚は不変）を常時有効化 ---
(() => {
  const once = (fn) => {
    let done = false;
    return (...args) => { if (!done) { done = true; fn(...args); } };
  };

  const ensureTimerAria = () => {
    const t = document.querySelector('[data-testid="timer"], #timer');
    if (!t) return;
    if (!t.getAttribute('aria-live'))   t.setAttribute('aria-live', 'polite');
    if (!t.getAttribute('aria-atomic')) t.setAttribute('aria-atomic', 'true');
  };

  const ensureProgressbarAria = () => {
    const bar = document.querySelector('[data-testid="score-bar"], #score-bar');
    if (!bar) return;
    bar.setAttribute('role', 'progressbar');
    bar.setAttribute('aria-valuemin', '0');
    bar.setAttribute('aria-valuemax', '100');
    const updateNow = () => {
      // 期待: style="width: NN%"
      const w = (bar.style && bar.style.width) || '';
      const m = w.match(/(\d+(?:\.\d+)?)%/);
      if (m) bar.setAttribute('aria-valuenow', String(Math.round(parseFloat(m[1]))));
    };
    updateNow();
    // 変化を監視して now を追従（重複バインド防止）
    if (!bar.dataset._a11yProgressMoBound) {
      const mo = new MutationObserver(() => updateNow());
      mo.observe(bar, { attributes: true, attributeFilter: ['style'] });
      bar.dataset._a11yProgressMoBound = '1';
    }
  };

  const annotateChoices = () => {
    const container = document.querySelector('#choices') || document.querySelector('[data-testid="choices"]');
    if (!container) return;
    container.querySelectorAll('button, .choice, [data-testid="choice"]').forEach((el) => {
      el.setAttribute('role', 'button'); // button要素でも冗長OK
      if (!el.hasAttribute('aria-pressed')) el.setAttribute('aria-pressed', 'false');
    });
    // クリックで aria-pressed をトグル（選択反映）: 重複バインド防止
    if (!container.dataset._a11yChoiceBound) {
      container.addEventListener('click', (e) => {
        const target = e.target.closest('button, .choice, [data-testid="choice"]');
        if (!target) return;
        container.querySelectorAll('button, .choice, [data-testid="choice"]').forEach((el) => {
          el.setAttribute('aria-pressed', el === target ? 'true' : 'false');
        });
      }, { passive: true });
      container.dataset._a11yChoiceBound = '1';
    }
  };

  const focusFirstControl = once(() => {
    // Free: answer、MC: 最初の選択肢
    const answer = document.querySelector('[data-testid="answer"], #answer');
    if (answer) { answer.focus?.(); return; }
    const firstChoice = document.querySelector('#choices button, .choice, [data-testid="choice"]');
    firstChoice?.focus?.();
  });

  const observeQuiz = () => {
    const quizView = document.querySelector('#question-view') || document.querySelector('[data-testid="quiz-view"]');
    if (!quizView) return;
    // 出題レンダ後にA11yを適用（属性変化は監視しない＝自己再帰ループ回避）
    const apply = () => { ensureTimerAria(); ensureProgressbarAria(); annotateChoices(); focusFirstControl(); };
    const mo = new MutationObserver((mutations) => {
      if (mutations.some(m => m.type === 'childList')) apply();
    });
    mo.observe(quizView, { childList: true, subtree: true }); // attributes: false
    apply();
  };

  window.addEventListener('DOMContentLoaded', () => {
    // Start押下後にもフォーカスが飛ぶよう保険
    const startBtn = document.querySelector('[data-testid="start-btn"], #start-btn');
    if (startBtn) startBtn.addEventListener('click', () => setTimeout(() => focusFirstControl(), 0), { once: true });
    observeQuiz();
    // 初期描画時にも最低限のA11yを適用
    ensureTimerAria();
    ensureProgressbarAria();
    focusFirstControl();
  }, { once: true });
})();
// --- /A11y ---

// デバッグ/検証用（TTL/in-flight挙動の確認に使用）
window.loadVersionPublic = async () => { await readVersionNoStore(false); await loadVersion(); };

function swSetVersionUrl() {
  try {
    // app側が実際に参照しているVERSION_URLを組み立て（既存の定義があればそれを優先）
    const url = (typeof VERSION_URL === 'string' && VERSION_URL) ||
                new URL('../build/version.json', document.baseURI).toString();
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'version_url', url });
      console.log('[app→sw] version_url:', url);
    }
  } catch (e) {
    console.warn('[app→sw] version_url post failed:', e);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // test=1 でも SW が既に稼働中のことはあるので、常に通知だけは試みる
  swSetVersionUrl();
}, { once: true });
