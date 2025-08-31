#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function jstDateString(d = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const parts = fmt.formatToParts(d).reduce((acc, p) => {
    if (p.type === 'year' || p.type === 'month' || p.type === 'day') acc[p.type] = p.value;
    return acc;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

(function attachHelpers(){
  // daily.json からタイプを推定（generate_ogp.js と同ロジックの軽量版）
  function deriveTypeLabel(daily) {
    const candidates = [
      daily?.question?.type, daily?.type, daily?.mode,
      daily?.q?.type, daily?.meta?.type, daily?.questionType,
    ].filter(v => typeof v === 'string' && v.trim().length);
    const norm = s => String(s).toLowerCase().replace(/[\s_-]+/g,'');
    const decide = (s) => {
      const n = norm(s);
      if (/^(title|song|track).*game/.test(n)) return 'title→game';
      if (/^game.*composer/.test(n)) return 'game→composer';
      if (/^(title|song|track).*composer/.test(n)) return 'title→composer';
      return null;
    };
    let label = (candidates[0] && decide(candidates[0])) || null;
    if (label) return label;
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
    return dfs(daily) || null;
  }
  module.exports = { deriveTypeLabel };
})();

(async () => {
  const date = process.env.DAILY_DATE && /^\d{4}-\d{2}-\d{2}$/.test(process.env.DAILY_DATE)
    ? process.env.DAILY_DATE
    : jstDateString();
  const base = process.env.PUBLIC_BASE || '';
  const repoRoot = process.cwd();
  const outDir = path.join(repoRoot, 'public', 'daily');
  fs.mkdirSync(outDir, { recursive: true });

  const appUrl = `${base}/app/?daily=${date}`;
  const ogpUrl = `${base}/ogp/daily-${date}.png`;
  const pageUrl = `${base}/daily/${date}.html`;
  // daily.json の内容ハッシュ（変更があれば share HTML も確実に変わる）
  let dailyHash = '';
  try {
    const buf = fs.readFileSync(path.join(repoRoot, 'public', 'app', 'daily.json'));
    dailyHash = crypto.createHash('sha1').update(buf).digest('hex').slice(0, 12);
  } catch (_) { /* noop */ }
  const ogpUrlWithV = dailyHash ? `${ogpUrl}?v=${dailyHash}` : ogpUrl;
  // サブタイトル優先順位: 環境変数 OGP_SUBTITLE > daily.json 推定 > 空
  let typeLabel = process.env.OGP_SUBTITLE || '';
  try {
    if (!process.env.OGP_SUBTITLE) {
      const dailyJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'public', 'app', 'daily.json'), 'utf8'));
      const { deriveTypeLabel } = module.exports;
      typeLabel = deriveTypeLabel(dailyJson) || '';
    }
  } catch (_) { /* noop */ }
  const ogTitle = typeLabel ? `VGM Quiz — Daily ${date} — ${typeLabel}` : `VGM Quiz — Daily ${date}`;
  const ogDesc  = typeLabel ? `1日1問のVGMクイズ（${typeLabel}）。今日の問題に挑戦！` : `1日1問のVGMクイズ。今日の問題に挑戦！`;

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${ogTitle}</title>
  <meta name="robots" content="index,follow">
  <link rel="canonical" href="${appUrl}">
  <meta property="og:locale" content="ja_JP">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="VGM Quiz">
  <meta property="og:title" content="${ogTitle}">
  <meta property="og:description" content="${ogDesc}">
  <meta property="og:image" content="${ogpUrlWithV}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:url" content="${pageUrl}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${ogTitle}">
  <meta name="twitter:description" content="${ogDesc}">
  <meta name="twitter:image" content="${ogpUrlWithV}">
  <meta name="twitter:url" content="${pageUrl}">
  <meta http-equiv="refresh" content="0; url=${appUrl}">
  <!-- daily-hash:${dailyHash} -->
</head>
<body>
  <p>Redirecting to <a href="${appUrl}">VGM Quiz — Daily ${date}</a> …</p>
  <noscript><a href="${appUrl}">Click here if you are not redirected.</a></noscript>
</body>
</html>`;

  const outPath = path.join(outDir, `${date}.html`);
  fs.writeFileSync(outPath, html);
  console.log(`Share page generated: ${path.relative(repoRoot, outPath)}`);
})();
