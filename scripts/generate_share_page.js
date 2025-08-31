#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

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

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>VGM Quiz — Daily ${date}</title>
  <meta name="robots" content="index,follow">
  <link rel="canonical" href="${appUrl}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="VGM Quiz">
  <meta property="og:title" content="VGM Quiz — Daily ${date}">
  <meta property="og:description" content="1日1問のVGMクイズ。今日の問題に挑戦！">
  <meta property="og:image" content="${ogpUrl}">
  <meta property="og:url" content="${pageUrl}">
  <meta name="twitter:card" content="summary_large_image">
  <meta http-equiv="refresh" content="0; url=${appUrl}">
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
