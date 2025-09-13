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
  <label>検索: <input id="q" placeholder="YYYY-MM-DD など"></label>
  <div id="nav"></div>
  <ul id="list">
    ${files.map(d => `<li data-date="${d}"><a href="./${d}.html">${d}</a></li>`).join('\n    ')}
  </ul>
  <script>
    (function(){
      var q = document.getElementById("q");
      var list = document.getElementById("list");
      var items = [].slice.call(list.querySelectorAll("li"));
      function apply(){
        var v = (q.value||"").trim();
        items.forEach(function(li){
          var d = li.getAttribute("data-date");
          li.style.display = (!v || d.indexOf(v) !== -1) ? "" : "none";
        });
      }
      q.addEventListener("input", apply);
      apply();
      // prev/next (relative to latest)
      var dates = items.map(function(li){return li.getAttribute("data-date");});
      var latest = dates[0];
      var prev = dates[1] || null;
      var nav = document.getElementById("nav");
      if (prev) nav.innerHTML = '<p><a href="./'+prev+'.html">← 前日: '+prev+'</a> ・ <a href="./latest.html">本日</a></p>';
    })();
  </script>
</body></html>`;

  const mkLatest = (d) => `<!doctype html>
<html lang="ja"><head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="VGM Quiz のデイリーページ（最新）。ゲーム音楽の1日1問にすぐアクセスできます。">
  <title>VGM Quiz — Daily latest</title>
  <script>(function(){try{var p=new URLSearchParams(location.search||"");if(p.get("no-redirect")==="1")return;var delay=parseInt(p.get("redirectDelayMs")||"0",10);if(isNaN(delay)||delay<0)delay=0;setTimeout(function(){location.replace(${JSON.stringify('./'+d+'.html')});},delay);}catch(e){}})();</script>
</head><body>
  <p>Redirecting to <a href="./${d}.html">${d}</a> …</p>
  <p><a id="cta-latest-app" href="../app/?daily_auto=1&daily=${d}">アプリで今日の1問へ</a></p>
</body></html>`;

  fs.writeFileSync(path.join(outDir, 'index.html'), mkIndex());
  fs.writeFileSync(path.join(outDir, 'latest.html'), mkLatest(today));
  console.log(`daily index generated: ${files.length} items, latest -> ${today}`);
})();
