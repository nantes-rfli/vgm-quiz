let tracks = [];
let questions = [];
let current = 0;
let score = 0;
let awaitingNext = false;
let currentRunId = null;
let datasetLoaded = false;
const aliases = {};
window.__APP_VERSION__ = 'dev';
window.__DATASET_VERSION__ = null;

const SETTINGS_KEY = 'quiz-options';
function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {};
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
const STORE = 'plays';
const dbPromise = new Promise((resolve, reject) => {
  const req = indexedDB.open(DB_NAME, 1);
  req.onupgradeneeded = () => {
    req.result.createObjectStore(STORE, { autoIncrement: true });
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
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).add({ ...rec, ts: Date.now() });
}

async function fetchHistory() {
  const db = await dbPromise;
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
    req.onsuccess = () => {
      resolve(req.result.sort((a, b) => b.ts - a.ts).slice(0, 20));
    };
    req.onerror = () => reject(req.error);
  });
}

async function clearHistoryStore() {
  const db = await dbPromise;
  db.transaction(STORE, 'readwrite').objectStore(STORE).clear();
}

function norm(str) {
  return str.normalize('NFKC').trim().toLowerCase();
}

function canonical(str) {
  const n = norm(str);
  return aliases[n] || n;
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
  document.getElementById('start-btn').disabled = !datasetLoaded || selectedTypes().length === 0;
}

async function loadDataset() {
  try {
    const res = await fetch('./build/dataset.json');
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
    const res = await fetch('./build/aliases.json');
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
  try {
    const res = await fetch('./build/version.json');
    const data = await res.json();
    window.__APP_VERSION__ = data.commit || 'dev';
    window.__DATASET_VERSION__ = data.dataset_version || null;
  } catch (err) {
    console.warn('Failed to load version', err);
  }
  const el = document.createElement('div');
  el.id = 'app-version';
  el.style.marginTop = '1em';
  el.textContent = `Version: ${window.__APP_VERSION__}`;
  document.body.appendChild(el);
}

function startQuiz() {
  currentRunId = Date.now();
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
  answer.value = '';
  answer.focus();
  feedback.textContent = '';
  submit.disabled = false;
  next.style.display = 'none';
  scoreBar.textContent = `Score: ${score}/${questions.length}`;
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
  const rawInput = document.getElementById('answer').value;
  const userAns = canonical(rawInput);
  const expected = canonical(q.expected);
  const feedback = document.getElementById('feedback');
  const scoreBar = document.getElementById('score-bar');
  const correct = userAns === expected;
  if (correct) {
    score++;
    feedback.textContent = 'Correct!';
  } else {
    feedback.textContent = `Incorrect. Correct: ${q.expected}`;
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
  current++;
  if (current >= questions.length) {
    showResult();
  } else {
    showQuestion();
  }
}

function showResult() {
  showView('result-view');
  document.getElementById('final-score').textContent = `Score: ${score}/${questions.length}`;
  const list = document.getElementById('summary-list');
  list.innerHTML = '';
  questions.forEach(q => {
    const li = document.createElement('li');
    li.textContent = `${TYPE_LABELS[q.type]} - ${q.correct ? '✅' : '❌'} - ${q.expected} - ${q.userAnswer || ''} - ${q.track.year} - ${q.track.game}`;
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
updateStartButton();

loadDataset();
loadAliases();

loadVersion().then(() => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', async event => {
      if (event.data && event.data.type === 'dataset-updated') {
        try {
          const res = await fetch('./build/version.json');
          const v = await res.json();
          if (v.dataset_version && v.dataset_version !== window.__DATASET_VERSION__) {
            if (confirm('新しい問題が利用可能です。更新しますか？')) {
              location.reload();
            }
            window.__DATASET_VERSION__ = v.dataset_version;
          }
        } catch (err) {
          console.error('Failed to check dataset version', err);
        }
      }
    });
    navigator.serviceWorker.register(`sw.js?v=${encodeURIComponent(window.__APP_VERSION__ || 'dev')}`).then(registration => {
      function showUpdateBanner() {
        if (document.getElementById('sw-update')) return;
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
          registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
          location.reload();
        });
        banner.appendChild(btn);
        document.body.appendChild(banner);
      }

      if (registration.waiting) {
        showUpdateBanner();
      }
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (registration.waiting) {
              showUpdateBanner();
            }
          });
        }
      });
      navigator.serviceWorker.addEventListener('controllerchange', showUpdateBanner);
    });
  }
});
