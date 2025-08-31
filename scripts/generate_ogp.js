#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

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

function deriveTypeLabel(daily) {
  // まずは素直に代表的なキーを参照
  const candidates = [
    daily?.question?.type, daily?.type, daily?.mode,
    daily?.q?.type, daily?.meta?.type, daily?.questionType,
  ].filter(v => typeof v === 'string' && v.trim().length);
  let raw = candidates[0] || null;
  // 正規化判定（よくある表記ゆれを吸収）
  const norm = s => String(s).toLowerCase().replace(/[\s_-]+/g,'');
  const decide = (s) => {
    const n = norm(s);
    if (/^(title|song|track).*game/.test(n)) return 'title→game';
    if (/^game.*composer/.test(n)) return 'game→composer';
    if (/^(title|song|track).*composer/.test(n)) return 'title→composer';
    return null;
  };
  let label = raw && decide(raw);
  if (label) return label;
  // ネストをざっくり探索（from/to式や ask/answer式があれば拾う）
  const hint = (x) => {
    const v = String(x || '').toLowerCase();
    if (['title','song','track','name'].includes(v)) return 'title';
    if (['game','series'].includes(v)) return 'game';
    if (['composer','artist'].includes(v)) return 'composer';
    return null;
  };
  const dfs = (obj, depth=0) => {
    if (!obj || typeof obj !== 'object' || depth > 3) return null;
    let from = null, to = null;
    for (const [k,v] of Object.entries(obj)) {
      if (typeof v === 'string') {
        if (!from) from = hint(v);
        if (!to) to = hint(v);
      } else if (typeof v === 'object') {
        const r = dfs(v, depth+1);
        if (r) return r;
      }
      // key 名が from/to/ask/answer ぽい場合
      if (typeof v === 'string' && /^(from|ask)$/i.test(k)) from = hint(v) || from;
      if (typeof v === 'string' && /^(to|answer)$/i.test(k)) to = hint(v) || to;
      if (from && to) break;
    }
    if (from && to) {
      if (from==='title' && to==='game') return 'title→game';
      if (from==='game'  && to==='composer') return 'game→composer';
      if (from==='title' && to==='composer') return 'title→composer';
    }
    return null;
  };
  label = dfs(daily);
  return label || null;
}

(async () => {
  // DAILY_DATE が未指定なら JST の ISO 文字列を採用
  const date = process.env.DAILY_DATE && /^\d{4}-\d{2}-\d{2}$/.test(process.env.DAILY_DATE)
    ? process.env.DAILY_DATE
    : jstDateString();
  const repoRoot = process.cwd();
  const outDir = path.join(repoRoot, 'public', 'ogp');
  fs.mkdirSync(outDir, { recursive: true });

  // daily.json から出題タイプを推定（失敗したら "Daily Question"）
  let subtitle = 'Daily Question';
  try {
    const dailyJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'public', 'app', 'daily.json'), 'utf8'));
    const label = deriveTypeLabel(dailyJson);
    if (label) subtitle = label;
  } catch (_) { /* noop */ }

  const fileUrl = 'file://' + path.join(repoRoot, 'tools', 'ogp', 'daily.html');
  const url = `${fileUrl}?date=${encodeURIComponent(date)}&subtitle=${encodeURIComponent(subtitle)}`;
  const outPath = path.join(outDir, `daily-${date}.png`);

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.screenshot({ path: outPath });
  await browser.close();

  console.log(`OGP generated: ${path.relative(repoRoot, outPath)}`);
})();
