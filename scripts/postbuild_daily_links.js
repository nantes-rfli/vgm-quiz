#!/usr/bin/env node
'use strict';
/**
 * Inject "AUTOで遊ぶ" link into public/daily/YYYY-MM-DD.html (if missing).
 * - Non-destructive: if the snippet exists, we skip.
 * - Insert before </body> with a light, inline-styled pill button.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const dailyDir = path.join(root, 'public', 'daily');

function listHtml(dir){
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.html')) : [];
}

function extractDateFromName(name){
  const m = name.match(/(\d{4}-\d{2}-\d{2})\.html$/);
  return m ? m[1] : null;
}

function buildSnippet(date){
  const url = `../app/?daily=${date}&auto=1`;
  return [
    '<div id="auto-entry-link" style="position:fixed;right:12px;bottom:12px;z-index:9999">',
    `  <a href="${url}" style="display:inline-block;padding:8px 12px;border-radius:999px;background:#0ea5e9;color:#fff;text-decoration:none;font-weight:700;box-shadow:0 2px 8px rgba(0,0,0,.15)">AUTOで遊ぶ</a>`,
    '</div>'
  ].join('\n');
}

function inject(file){
  const p = path.join(dailyDir, file);
  let html = fs.readFileSync(p, 'utf-8');
  if (html.includes('id="auto-entry-link"')) return false;
  const date = extractDateFromName(file);
  if (!date) return false;
  const snippet = buildSnippet(date);
  if (html.includes('</body>')) {
    html = html.replace('</body>', snippet + '\n</body>');
  } else {
    html += '\n' + snippet + '\n';
  }
  fs.writeFileSync(p, html);
  return true;
}

function main(){
  const files = listHtml(dailyDir).filter(f => !/^(index|latest)\.html$/.test(f));
  let updated = 0;
  for (const f of files){
    try { if (inject(f)) updated++; } catch (e) { console.warn('[auto link] skip', f, e.message); }
  }
  console.log(`[auto link] updated=${updated} files`);
}

if (require.main === module) main();
