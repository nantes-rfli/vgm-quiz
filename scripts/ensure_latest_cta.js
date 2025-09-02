// Ensure latest.html includes a CTA link to the app daily page (id="cta-latest-app").
// Idempotent: inserts only once.
// Usage: node scripts/ensure_latest_cta.js
const fs = require('fs');
const path = require('path');

const latestPath = path.join(process.cwd(), 'public', 'daily', 'latest.html');
if (!fs.existsSync(latestPath)) {
  console.log('[ensure_latest_cta] skip: file not found:', latestPath);
  process.exit(0);
}
let html = fs.readFileSync(latestPath, 'utf8');
if (html.includes('id="cta-latest-app"')) {
  console.log('[ensure_latest_cta] CTA already present');
  process.exit(0);
}
// Find redirect paragraph anchor
const anchor = /<p>Redirecting to <a href="\.\/\$\{d\}\.html">\$\{d\}<\/a> …<\/p>/;
if (anchor.test(html)) {
  html = html.replace(anchor, (m) => m + '\n  <p><a id="cta-latest-app" href="../app/?daily=${d}">アプリで今日の1問へ</a></p>');
} else if (/<body>/i.test(html)) {
  html = html.replace(/<body>/i, '<body>\n  <p><a id="cta-latest-app" href="../app/?daily=${d}">アプリで今日の1問へ</a></p>');
} else {
  // last resort: append
  html += '\n<p><a id="cta-latest-app" href="../app/?daily=${d}">アプリで今日の1問へ</a></p>\n';
}
fs.writeFileSync(latestPath, html, 'utf8');
console.log('[ensure_latest_cta] CTA inserted');

