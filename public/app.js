let tracks = [];
let questions = [];
let current = 0;
let score = 0;
let awaitingNext = false;
const aliases = {};

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

async function loadDataset() {
  try {
    const res = await fetch('./build/dataset.json');
    const data = await res.json();
    tracks = data.tracks;
    document.getElementById('start-btn').disabled = false;
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

function startQuiz() {
  const countInput = document.getElementById('count');
  let n = parseInt(countInput.value, 10);
  if (!n || n < 1) n = 1;
  const deduped = distinctBy(['title', 'game', 'composer'], tracks);
  n = Math.min(n, deduped.length);
  const selected = spreadByBucket(deduped, t => yearBucket(t.year), n);
  const types = ['title-game', 'game-composer', 'title-composer'];
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
  const feedback = document.getElementById('feedback');
  answer.value = '';
  feedback.textContent = '';
  submit.textContent = 'Submit';
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

function submitAnswer() {
  if (awaitingNext) {
    nextQuestion();
    return;
  }
  const q = questions[current];
  const promptText = document.getElementById('prompt').textContent;
  const rawInput = document.getElementById('answer').value;
  const userAns = canonical(rawInput);
  const expected = canonical(q.expected);
  const feedback = document.getElementById('feedback');
  const correct = userAns === expected;
  if (correct) {
    score++;
    feedback.textContent = 'Correct!';
  } else {
    feedback.textContent = `Incorrect. Correct: ${q.expected}`;
  }
  recordPlay({
    track: q.track,
    prompt: promptText,
    expected: q.expected,
    userAnswer: rawInput,
    correct
  });
  const submit = document.getElementById('submit-btn');
  submit.textContent = current === questions.length - 1 ? 'Finish' : 'Next';
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
}

function restart() {
  showView('start-view');
}

async function showHistory() {
  const list = document.getElementById('history-list');
  list.innerHTML = '';
  const items = await fetchHistory();
  items.forEach(p => {
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
document.getElementById('restart-btn').addEventListener('click', restart);
document.getElementById('history-btn').addEventListener('click', showHistory);
document.getElementById('history-back-btn').addEventListener('click', () => showView('start-view'));
document.getElementById('clear-history-btn').addEventListener('click', clearHistory);

loadDataset();
loadAliases();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').then(registration => {
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
