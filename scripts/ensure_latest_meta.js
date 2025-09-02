// Ensure <meta name="description"> exists in public/daily/latest.html (idempotent)
// Usage: node scripts/ensure_latest_meta.js
const fs = require('fs');
const path = require('path');

const latestPath = path.join(process.cwd(), 'public', 'daily', 'latest.html');
if (!fs.existsSync(latestPath)) {
  console.log('[ensure_latest_meta] skip: file not found:', latestPath);
  process.exit(0);
}
let html = fs.readFileSync(latestPath, 'utf8');
if (/\<meta\s+name=["']description["']/i.test(html)) {
  console.log('[ensure_latest_meta] already has meta description');
  process.exit(0);
}
const meta = '  <meta name="description" content="VGM Quiz のデイリーページ（最新）。ゲーム音楽の1日1問にすぐアクセスできます。">';
// Try to insert after viewport
if (/\<meta\s+name=["']viewport["'][^>]*\>/.test(html)) {
  html = html.replace(/(\<meta\s+name=["']viewport["'][^>]*\>)/i, '$1\n' + meta);
} else if (/\<head\>/.test(html)) {
  html = html.replace(/\<head\>/i, '<head>\n' + meta + '\n');
} else {
  // last resort: prepend
  html = meta + '\n' + html;
}
fs.writeFileSync(latestPath, html, 'utf8');
console.log('[ensure_latest_meta] meta description inserted');

