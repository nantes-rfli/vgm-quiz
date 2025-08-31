#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function jstISO(d = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' });
  const p = Object.fromEntries(fmt.formatToParts(d).map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}

(async () => {
  const root = process.cwd();
  const outDir = path.join(root, 'public', 'daily');
  fs.mkdirSync(outDir, { recursive: true });

  // 既存の daily/*.html を列挙
  const files = fs.readdirSync(outDir)
    .filter(f => /^\d{4}-\d{2}-\d{2}\.html$/.test(f))
    .map(f => f.replace(/\.html$/, ''));
  files.sort((a,b) => a < b ? 1 : (a > b ? -1 : 0)); // 降順

  const today = jstISO();
  const mkIndex = () => `<!doctype html>
<html lang="ja"><head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <title>VGM Quiz — Daily index</title>
  <meta name="robots" content="index,follow">
  <link rel="canonical" href="./index.html">
  <link rel="alternate" type="application/rss+xml" title="VGM Quiz — Daily" href="./feed.xml">
  <style>
    body{font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial;margin:24px;line-height:1.6;}
    h1{font-size:20px;margin:0 0 12px} ul{padding-left:18px;margin:0}
    li{margin:4px 0} a{color:#0366d6;text-decoration:none} a:hover{text-decoration:underline}
    .meta{opacity:.7;font-size:12px;margin:6px 0 16px}
  </style>
</head><body>
  <h1>VGM Quiz — Daily index</h1>
  <p><a href="./feed.xml">RSSフィード</a>（購読できます）</p>
  <div class="meta">today: ${today} / count: ${files.length}</div>
  <ul>
    ${files.map(d => `<li><a href="./${d}.html">${d}</a></li>`).join('\n    ')}
  </ul>
</body></html>`;

  const mkLatest = (d) => `<!doctype html>
<html lang="ja"><head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <title>VGM Quiz — Daily latest</title>
  <meta http-equiv="refresh" content="0; url=./${d}.html">
</head><body>
  <p>Redirecting to <a href="./${d}.html">${d}</a> …</p>
</body></html>`;

  fs.writeFileSync(path.join(outDir, 'index.html'), mkIndex());
  fs.writeFileSync(path.join(outDir, 'latest.html'), mkLatest(today));
  console.log(`daily index generated: ${files.length} items, latest -> ${today}`);
})();
