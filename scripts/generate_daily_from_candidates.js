#!/usr/bin/env node
'use strict';
/**
 * Pick one candidate for a given date and write/merge into public/app/daily_auto.json
 * - non-destructive to existing daily.json
 * - 30-day dedup (within daily_auto.json only)
 */
const fs = require('fs');
const path = require('path');

function parseArgs(){
  const a = process.argv.slice(2);
  const i = a.indexOf('--in');  const input = i>=0 ? a[i+1] : 'public/app/daily_candidates_scored.jsonl';
  const d = a.indexOf('--date'); const date = d>=0 ? a[d+1] : (new Date(Date.now()+9*3600*1000)).toISOString().slice(0,10);
  const o = a.indexOf('--out'); const output = o>=0 ? a[o+1] : 'public/app/daily_auto.json';
  return { input, date, output };
}
function ensureDir(dir){ fs.mkdirSync(dir, { recursive:true }); }
function readJSON(p){ return JSON.parse(fs.readFileSync(p,'utf-8')); }
function readJSONL(p){ return fs.readFileSync(p,'utf-8').trim().split(/\n+/).map(JSON.parse); }
function pick(cands){
  // stable pick: lowest difficulty, then alphabetical
  const sorted = [...cands].sort((a,b)=> (a.difficulty-b.difficulty) || (a.norm.title.localeCompare(b.norm.title)));
  return sorted[0];
}
function datesBetween(startISO, days){
  const out = new Set();
  const base = new Date(startISO+'T00:00:00+09:00');
  for(let k=0;k<days;k++){
    const d = new Date(base.getTime() - k*86400000);
    out.add(d.toISOString().slice(0,10));
  }
  return out;
}

function main(){
  const { input, date, output } = parseArgs();
  if(!fs.existsSync(input)){ console.error(`[generate-auto] not found: ${input}`); process.exit(1); }
  const cands = readJSONL(input);
  const outDir = path.dirname(output); ensureDir(outDir);
  let auto = { by_date: {} };
  if (fs.existsSync(output)) {
    try { auto = readJSON(output); } catch {}
    auto.by_date ||= {};
  }
  // 30-day dedup within daily_auto.json
  const recent = datesBetween(date, 30);
  const usedKeys = new Set();
  for(const k of Object.keys(auto.by_date)){
    if (recent.has(k)) {
      const v = auto.by_date[k];
      const key = `${v.norm.title}|${v.norm.game}|${v.norm.composer}`;
      usedKeys.add(key);
    }
  }
  const pool = cands.filter(c => {
    const key = `${c.norm.title}|${c.norm.game}|${c.norm.composer}`;
    return !usedKeys.has(key);
  });
  if (pool.length === 0){ console.error('[generate-auto] no available candidates after dedup'); process.exit(2); }
  const chosen = pick(pool);
  auto.by_date[date] = chosen;
  fs.writeFileSync(output, JSON.stringify(auto, null, 2));
  console.log(`[generate-auto] date=${date} saved to ${output}`);
}

if (require.main === module) main();
