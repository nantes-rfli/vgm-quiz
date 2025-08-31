#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const repoRoot = process.cwd();
const dailyDir = path.join(repoRoot, 'public', 'daily');
const appDailyJson = path.join(repoRoot, 'public', 'app', 'daily.json');
const feedXml = path.join(dailyDir, 'feed.xml');

if (!fs.existsSync(dailyDir)) {
  console.error('Missing directory: public/daily');
  process.exit(1);
}

const must = ['index.html', 'latest.html'];
for (const f of must) {
  const p = path.join(dailyDir, f);
  if (!fs.existsSync(p)) {
    console.error('Missing file: ' + path.relative(repoRoot, p));
    process.exit(1);
  }
}

const days = (fs.readdirSync(dailyDir).filter(f => /^\d{4}-\d{2}-\d{2}\.html$/.test(f))).sort();
if (days.length === 0) {
  console.error('No daily pages found (public/daily/YYYY-MM-DD.html)');
  process.exit(1);
}

let missingType = 0;
try {
  const dailyJson = JSON.parse(fs.readFileSync(appDailyJson, 'utf8'));
  const map = dailyJson && typeof dailyJson === 'object' ? (dailyJson.map || dailyJson) : {};
  for (const [d, v] of Object.entries(map)) {
    if (!v || typeof v.type !== 'string') missingType++;
  }
} catch (e) {
  console.warn('[smoke-daily] WARN: cannot parse daily.json: ' + e.message);
}
if (missingType > 0) {
  console.warn(`[smoke-daily] WARN: ${missingType} entries in daily.json have no 'type'. (Will default to 'title→game')`);
}

// Feed presence
if (!fs.existsSync(feedXml)) {
  console.warn(`[smoke-daily] WARN: ${feedXml} not found (RSS feed generation is recommended).`);
}

console.log('Daily pages OK. Count=', days.length, 'Example=', days.slice(-3).join(', '));
