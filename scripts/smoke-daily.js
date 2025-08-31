#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const repoRoot = process.cwd();
const dailyDir = path.join(repoRoot, 'public', 'daily');

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

console.log('Daily pages OK. Count=', days.length, 'Example=', days.slice(-3).join(', '));
