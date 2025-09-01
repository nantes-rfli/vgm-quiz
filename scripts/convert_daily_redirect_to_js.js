// scripts/convert_daily_redirect_to_js.js
// Post-processes public/daily/*.html:
//  - Replace <meta http-equiv="refresh" ...> with a JS-based redirect
//  - Adds support for ?no-redirect=1 to suppress redirect (for debugging)
//  - Adds support for ?redirectDelayMs=1500 to delay redirect
//
// Usage:
//   node scripts/convert_daily_redirect_to_js.js
//
// Notes:
//  - Safe to run multiple times; idempotent.
//  - Keeps existing content and tries to preserve the "AUTOで遊ぶ" button section.

const fs = require('fs');
const path = require('path');

const DAILY_DIR = path.join(process.cwd(), 'public', 'daily');

function toJSRedirect(targetUrl) {
  // JS redirect snippet with no-redirect/redirectDelayMs support
  return [
    '<script>',
    '(function(){',
    '  try {',
    '    var params = new URLSearchParams(location.search || "");',
    '    if (params.get("no-redirect") === "1") {',
    '      console.log("[daily] no-redirect=1; skipping redirect");',
    '      return;',
    '    }',
    '    var delay = parseInt(params.get("redirectDelayMs") || "0", 10);',
    '    if (isNaN(delay) || delay < 0) delay = 0;',
    '    var url = ' + JSON.stringify(targetUrl) + ';',
    '    setTimeout(function(){ location.replace(url); }, delay);',
    '  } catch (e) {',
    '    console.warn("[daily] redirect exception:", e);',
    '    // Fallback: do nothing (stay on the page for inspection)',
    '  }',
    '})();',
    '</script>'
  ].join('\n');
}

function rewriteHtml(html) {
  // 1) Detect meta refresh
  // Matches: <meta http-equiv="refresh" content="0; url=..."> (variations tolerated)
  const metaRegex = /<meta\s+http-equiv=["']?refresh["']?\s+content=["']?\s*\d+\s*;\s*url=([^"'>\s]+)["']?\s*\/?>/i;
  const m = html.match(metaRegex);

  if (!m) {
    // Already converted or no redirect present; return as-is
    return html;
  }
  const targetUrl = m[1];

  // 2) Remove meta tag and inject JS redirect (preferably near the end of <head>)
  let out = html.replace(metaRegex, '');
  const headCloseIdx = out.search(/<\/head>/i);
  const snippet = toJSRedirect(targetUrl) + '\n';

  if (headCloseIdx !== -1) {
    out = out.slice(0, headCloseIdx) + snippet + out.slice(headCloseIdx);
  } else {
    // No </head> found; append at end
    out += '\n' + snippet;
  }

  return out;
}

function processDailyHtml(dir) {
  if (!fs.existsSync(dir)) {
    console.error("Not found:", dir);
    process.exit(1);
  }
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));
  let changed = 0;
  for (const f of files) {
    const p = path.join(dir, f);
    const html = fs.readFileSync(p, 'utf8');
    const newHtml = rewriteHtml(html);
    if (newHtml !== html) {
      fs.writeFileSync(p, newHtml, 'utf8');
      changed++;
      console.log("[daily] converted:", f);
    } else {
      console.log("[daily] unchanged:", f);
    }
  }
  console.log("[daily] done. changed =", changed, "/", files.length);
}

processDailyHtml(DAILY_DIR);
