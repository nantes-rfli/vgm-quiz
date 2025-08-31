#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function deriveTypeLabel(daily) {
  const pick = [
    daily?.question?.type, daily?.type, daily?.mode,
    daily?.q?.type, daily?.meta?.type, daily?.questionType,
  ].find(v => typeof v === 'string' && v.trim());
  const norm = s => String(s).toLowerCase().replace(/[\s_-]+/g,'');
  const decide = (s) => {
    const n = norm(s);
    if (/^(title|song|track).*game/.test(n)) return 'title→game';
    if (/^game.*composer/.test(n)) return 'game→composer';
    if (/^(title|song|track).*composer/.test(n)) return 'title→composer';
    return null;
  };
  let label = pick && decide(pick);
  if (label) return label;
  // 構造探索（浅め）
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

(async () => {
  const root = process.cwd();
  const fp = path.join(root, 'public', 'app', 'daily.json');
  let json = JSON.parse(fs.readFileSync(fp, 'utf8'));
  const label = deriveTypeLabel(json);
  json.ogp = json.ogp || {};
  if (label) json.ogp.subtitle = label;
  // 変更があるときのみ書き戻し
  const next = JSON.stringify(json, null, 2) + '\n';
  const prev = fs.readFileSync(fp, 'utf8');
  if (next !== prev) {
    fs.writeFileSync(fp, next);
    console.log(`[derive_meta] ogp.subtitle = "${label || ''}"`);
  } else {
    console.log('[derive_meta] no change');
  }
})();

