// Lightweight HTML contract check (no real browser)
const fs = require('fs');
const cheerio = require('cheerio');

const html = fs.readFileSync('public/app/index.html', 'utf-8');
const $ = cheerio.load(html);

// Check #mode options
const modeVals = $('#mode option').map((i, el) => $(el).attr('value')).get();
const required = ['multiple-choice', 'free'];
for (const r of required) {
  if (!modeVals.includes(r)) {
    console.error(`Missing mode option: ${r}`);
    process.exit(1);
  }
}

// Check #start exists (id or recognizable label)
if (!$('#start').length && !$('button:contains("開始"),button:contains("スタート"),button:contains("Start")').length) {
  console.error('Start button not found');
  process.exit(1);
}

console.log('Smoke HTML test passed.');
