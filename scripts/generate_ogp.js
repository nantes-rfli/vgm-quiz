#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

// Prefer daily.json.type; fallback to env OGP_SUBTITLE for backward compatibility.
const OGP_SUBTITLE_ENV = process.env.OGP_SUBTITLE;

function loadDailyMap() {
  const p = path.join(__dirname, '..', 'public', 'app', 'daily.json');
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8')).map || {};
  } catch (_) {
    return {};
  }
}

function typeToSubtitle(t) {
  switch (t) {
    case 'title→game': return 'Title → Game';
    case 'game→composer': return 'Game → Composer';
    case 'title→composer': return 'Title → Composer';
    default: return OGP_SUBTITLE_ENV || 'Title → Game';
  }
}

const DAILY_MAP = loadDailyMap();

function jstDateString(d = new Date()) {
  // en-CA は ISO っぽい 4桁年-2桁月-2桁日 を返す
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = fmt.formatToParts(d).reduce((acc, p) => {
    if (p.type === 'year' || p.type === 'month' || p.type === 'day') acc[p.type] = p.value;
    return acc;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

(async () => {
  // DAILY_DATE が未指定なら JST の ISO 文字列を採用
  const date = process.env.DAILY_DATE && /^\d{4}-\d{2}-\d{2}$/.test(process.env.DAILY_DATE)
    ? process.env.DAILY_DATE
    : jstDateString();
  const repoRoot = process.cwd();
  const outDir = path.join(repoRoot, 'public', 'ogp');
  fs.mkdirSync(outDir, { recursive: true });

  const chosenType = (DAILY_MAP[date] && DAILY_MAP[date].type) || OGP_SUBTITLE_ENV || 'title→game';
  const subtitle = typeToSubtitle(chosenType);

  const fileUrl = 'file://' + path.join(repoRoot, 'tools', 'ogp', 'daily.html');
  const url = `${fileUrl}?date=${encodeURIComponent(date)}&subtitle=${encodeURIComponent(subtitle)}`;
  const outPath = path.join(outDir, `daily-${date}.png`);

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.screenshot({ path: outPath });
  await browser.close();

  console.log(`OGP generated: ${path.relative(repoRoot, outPath)}  (subtitle="${subtitle}")`);
})();
