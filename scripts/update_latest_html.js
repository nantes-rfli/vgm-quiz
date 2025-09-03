#!/usr/bin/env node
// Update public/daily/latest.html to redirect to today's page (JST).
const fs = require('fs');
const path = require('path');

function todayJST() {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit'
  });
  const p = Object.fromEntries(fmt.formatToParts(new Date()).map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}

(function main() {
  const root = process.cwd();
  const dailyDir = path.join(root, 'public', 'daily');
  const latestPath = path.join(dailyDir, 'latest.html');
  const d = todayJST();
  if (!fs.existsSync(dailyDir)) fs.mkdirSync(dailyDir, { recursive: true });

  const html = [
    '<!doctype html>',
    '<html lang="ja"><head>',
    '  <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">',
    '  <meta name="description" content="VGM Quiz のデイリーページ（最新）。ゲーム音楽の1日1問にすぐアクセスできます。">',
    '  <title>VGM Quiz — Daily latest</title>',
    `  <meta http-equiv="refresh" content="0; url=./${d}.html">`,
    '</head><body>',
    `  <p>Redirecting to <a href="./${d}.html">${d}</a> …</p>`,
    `  <p><a id="cta-latest-app" href="../app/?daily=${d}">アプリで今日の1問へ</a></p>`,
    '</body></html>'
  ].join('\n');

  fs.writeFileSync(latestPath, html, 'utf8');
  console.log('[update_latest] wrote', path.relative(root, latestPath), '->', d);
})();
