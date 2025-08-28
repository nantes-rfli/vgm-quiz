let tracks = [];
let questions = [];
let current = 0;
let score = 0;
let awaitingNext = false;
let currentRunId = null;
let datasetLoaded = false;
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

// DETERMINISTIC RNG: URL に ?seed=xxx があれば Math.random を決定化
(() => {
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
  // 以後の乱択をすべて決定的にする
  const origRandom = Math.random;
  Object.defineProperty(Math, 'random', {
    value: rng,
    configurable: true,
    writable: true,
  });
  // デバッグ用に記録（E2Eのtrace/consoleで確認可能）
  try { console.info('[SEED]', seedParam, seedInt); } catch (_) {}
  // 必要なら元に戻せるよう window に退避
  window.__ORIG_RANDOM__ = origRandom;
  window.__SEED__ = seedParam;
})();

async function readVersionNoStore(){
  const r = await fetch(VERSION_URL,{cache:'no-store'});
  return r.json();
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
function showUpdateBanner(){
  if(document.getElementById('sw-update') || !swRegistration) return;
  const banner = document.createElement('div');
  banner.id = 'sw-update';
  banner.style.position = 'fixed';
  banner.style.bottom = '0';
  banner.style.left = '0';
  banner.style.right = '0';
  banner.style.background = '#333';
  banner.style.color = '#fff';
  banner.style.padding = '8px';
  banner.style.textAlign = 'center';
  const btn = document.createElement('button');
  btn.textContent = '更新があります。リロードしますか？';
  btn.addEventListener('click', () => {
    swRegistration.waiting?.postMessage({type:'SKIP_WAITING'});
    navigator.serviceWorker.addEventListener('controllerchange', applyUpdateAndReload);
  });
  banner.appendChild(btn);
  document.body.appendChild(banner);
}

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
  return str.normalize('NFKC').trim().toLowerCase();
}

function canonical(str) {
  const n = norm(str);
  return aliases[n] || n;
}

function levenshtein(a, b) {
  const dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[a.length][b.length];
}

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
    const res = await fetch(DATASET_URL, { cache: 'no-store' });
    const data = await res.json();
    tracks = data.tracks;
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
    if (!res.ok) return;
    const data = await res.json();
    Object.values(data).forEach(cat => {
      Object.entries(cat).forEach(([canon, list]) => {
        aliases[canon] = canon;
        list.forEach(a => aliases[a] = canon);
      });
    });
  } catch (err) {
    console.warn('Failed to load aliases', err);
  }
}

async function loadVersion() {
  // 1) version.json（データセット情報）を取得
  let datasetVersion = null;
  let contentHash = null;
  let generatedAt = null;
  try {
    const res = await fetch(VERSION_URL, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      datasetVersion = data.dataset_version || null;
      contentHash = data.content_hash || null;
      generatedAt = data.generated_at || null;
      window.__DATASET_VERSION__ = datasetVersion;
    }
  } catch (err) {
    console.warn('Failed to load version.json', err);
  }

  // 2) build.json（Pages ビルドのコミット情報）を取得：常に最新を取りにいく
  let shortSha = null;
  try {
    const res = await fetch('./build.json?cache=' + Date.now(), { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      window.__APP_VERSION__ = data.commit || 'dev';
      shortSha = data.short_sha || (data.commit ? data.commit.slice(0,7) : null);
    } else {
      throw new Error('build.json not found');
    }
  } catch (err) {
    console.warn('Failed to load build.json', err);
  }

  // 3) 画面に表示
  const parts = [];
  if (datasetVersion) parts.push(`Dataset v${datasetVersion}`);
  if (contentHash)    parts.push(String(contentHash).slice(0, 8));
  if (generatedAt)    parts.push(new Date(generatedAt).toLocaleString());
  if (shortSha)       parts.push(`commit: ${shortSha}`);
  const el = document.getElementById('ver');
  if (el) {
    el.textContent = parts.length ? parts.join(' • ') : 'local build';
    el.style.fontSize = 'small';
    el.style.opacity  = '0.7';
    el.style.textAlign= 'center';
  }
}

function escapeCsv(str) {
  return '"' + String(str).replace(/"/g, '""') + '"';
}

function toMinhayaCsv(items) {
  const rows = items.map(it => `${escapeCsv(it.question)},${escapeCsv(it.answer)},${escapeCsv(it.explanation || '')}`);
  return `question,answer,explanation\n${rows.join('\n')}`;
}

function exportMinhaya() {
  const countSelect = document.getElementById('count');
  let n = parseInt(countSelect.value, 10) || 5;
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

function startQuiz() {
  currentRunId = Date.now();
  const modeSelect = document.getElementById('mode');
  questionMode = modeSelect.value;
  useTimer = document.getElementById('timer20').checked;
  settings.mode = questionMode;
  saveSettings();
  const countSelect = document.getElementById('count');
  let n = parseInt(countSelect.value, 10) || 5;
  const deduped = distinctBy(['title', 'game', 'composer'], tracks);
  n = Math.min(n, deduped.length);
  const selected = spreadByBucket(deduped, t => yearBucket(t.year), n);
  const types = selectedTypes();
  questions = selected.map(track => ({ track, type: types[Math.floor(Math.random() * types.length)] }));
  current = 0;
  score = 0;
  showQuestion();
}

function showQuestion() {
  awaitingNext = false;
  showView('question-view');
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
    const opts = generateChoices(q.track, q.type, tracks, canonical).sort(() => Math.random() - 0.5);
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
    const dist = levenshtein(norm(rawInput), norm(q.expected));
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
  const list = document.getElementById('summary-list');
  list.innerHTML = '';
  questions.forEach(q => {
    const li = document.createElement('li');
    li.textContent = `${TYPE_LABELS[q.type]} - ${q.correct ? '✅' : '❌'} - ${q.expected} - ${q.userAnswer || ''} - ${q.track.year} - ${q.track.game} - ${q.elapsed}s`;
    list.appendChild(li);
  });
}

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
loadDataset();
loadAliases();

navigator.serviceWorker?.addEventListener('message', async (e)=>{
  if(e.data?.type==='version-refreshed'){
    const {content_hash} = await readVersionNoStore();
    if(currentHash() !== content_hash){ showUpdateBanner(); }
  }
});

loadVersion().then(() => {
  if ('serviceWorker' in navigator) {
    const v = window.__APP_VERSION__ || 'dev';
    if (__IS_TEST_MODE__) {
      // E2E / CI 用。SW は登録しない
    } else {
      navigator.serviceWorker.register(`./sw.js?v=${encodeURIComponent(v)}`).then(reg => {
        swRegistration = reg;
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
