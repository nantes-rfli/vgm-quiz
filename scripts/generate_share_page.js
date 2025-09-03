#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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
  const chosenType = (DAILY_MAP[date] && DAILY_MAP[date].type) || OGP_SUBTITLE_ENV || 'title→game';
  const subtitle = typeToSubtitle(chosenType);
  const ogTitle = `VGM Quiz — Daily ${date} — ${subtitle}`;
  const ogDesc  = `1日1問のVGMクイズ（${subtitle}）。今日の問題に挑戦！`;
  const title = ogTitle;
  const ogpImage = ogpUrlWithV;

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
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:image" content="${ogpImage}">
  <script>(function(){try{var p=new URLSearchParams(location.search||"");if(p.get("no-redirect")==="1")return;var d=parseInt(p.get("redirectDelayMs")||"0",10);if(isNaN(d)||d<0)d=0;setTimeout(function(){location.replace(${JSON.stringify(appUrl)});},d);}catch(e){}})();</script>
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
