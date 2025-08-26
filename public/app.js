let tracks = [];
let questions = [];
let current = 0;
let score = 0;
let awaitingNext = false;

function showView(id) {
  document.getElementById('start-view').style.display = id === 'start-view' ? 'block' : 'none';
  document.getElementById('question-view').style.display = id === 'question-view' ? 'block' : 'none';
  document.getElementById('result-view').style.display = id === 'result-view' ? 'block' : 'none';
}

function norm(str) {
  return str.normalize('NFKC').trim().toLowerCase();
}

async function loadDataset() {
  try {
    const res = await fetch('./build/dataset.json');
    const data = await res.json();
    tracks = data.tracks;
    document.getElementById('start-btn').disabled = false;
  } catch (err) {
    console.error('Failed to load dataset', err);
  }
}

function startQuiz() {
  const countInput = document.getElementById('count');
  let n = parseInt(countInput.value, 10);
  if (!n || n < 1) n = 1;
  n = Math.min(n, tracks.length);
  const shuffled = [...tracks].sort(() => Math.random() - 0.5).slice(0, n);
  const types = ['title-game', 'game-composer', 'title-composer'];
  questions = shuffled.map(track => ({ track, type: types[Math.floor(Math.random() * types.length)] }));
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
  const userAns = norm(document.getElementById('answer').value);
  const expected = norm(q.expected);
  const feedback = document.getElementById('feedback');
  if (userAns === expected) {
    score++;
    feedback.textContent = 'Correct!';
  } else {
    feedback.textContent = `Incorrect. Correct: ${q.expected}`;
  }
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

document.getElementById('start-btn').addEventListener('click', startQuiz);
document.getElementById('submit-btn').addEventListener('click', submitAnswer);
document.getElementById('restart-btn').addEventListener('click', restart);

loadDataset();
