#!/usr/bin/env node
'use strict';
/**
 * Pick one candidate for a given date and write/merge into public/app/daily_auto.json
 * - non-destructive to existing daily.json
 * - 30-day dedup (within daily_auto.json only)
 * - optional: attach multiple-choice distractors (composer/game)
 */
const fs = require('fs');
const path = require('path');
const { normalizeAnswer } = require('./pipeline/normalize');

function parseArgs(){
  const a = process.argv.slice(2);
  const i = a.indexOf('--in');  const input = i>=0 ? a[i+1] : 'public/app/daily_candidates_scored.jsonl';
  const d = a.indexOf('--date'); const date = d>=0 ? a[d+1] : (new Date(Date.now()+9*3600*1000)).toISOString().slice(0,10);
  const o = a.indexOf('--out'); const output = o>=0 ? a[o+1] : 'public/app/daily_auto.json';
  const wc = a.indexOf('--with-choices'); const withChoices = wc>=0 ? true : false;
  const ds = a.indexOf('--dataset'); const datasetPath = ds>=0 ? a[ds+1] : 'public/build/dataset.json';
  return { input, date, output, withChoices, datasetPath };
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
// deterministic PRNG (mulberry32) from a seed (u32)
function mulberry32(a){ return function(){ let t=a+=0x6D2B79F5; t=Math.imul(t^t>>>15, t|1); t^=t+Math.imul(t^t>>>7, t|61); return ((t^t>>>14)>>>0)/4294967296; } }
function fnv1a(str){ let h=2166136261>>>0; for(let i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,16777619);} return h>>>0; }
function pickN(arr, n, rnd){ const a=[...arr]; const out=[]; while(a.length && out.length<n){ const i=Math.floor(rnd()*a.length); out.push(a.splice(i,1)[0]); } return out; }
function decade(y){ return y? Math.floor(y/10)*10 : null; }

function buildPools(dataset, chosen){
  const list = Array.isArray(dataset) ? dataset : (dataset.tracks || []);
  const compSet = new Map(); const gameSet = new Map();
  for(const r of list){
    const comp = r.composer || ''; const game = r.game || ''; const plat = r.platform || r.system || null; const yr = r.year || null;
    const cn = normalizeAnswer(comp); const gn = normalizeAnswer(game);
    if (!cn || !gn) continue;
    if (cn===chosen.norm.composer && gn===chosen.norm.game) continue;
    const keyC = cn; if (!compSet.has(keyC)) compSet.set(keyC, { name: comp, year: yr, platform: plat });
    const keyG = gn; if (!gameSet.has(keyG)) gameSet.set(keyG, { name: game, year: yr, platform: plat });
  }
  return { composers: Array.from(compSet.values()), games: Array.from(gameSet.values()) };
}

function makeChoices(dataset, chosen, seedStr){
  const pools = buildPools(dataset, chosen);
  const rnd = mulberry32(fnv1a(seedStr));
  const targetDec = decade(chosen.year||0); const targetPlat = chosen.platform||null;
  const compCandidates = pools.composers
    .map(c => ({ c, score: (c.platform===targetPlat?2:0) + (targetDec && decade(c.year)===targetDec ? 1:0) }))
    .sort((a,b)=> b.score-a.score);
  const compTop = compCandidates.filter(x=>x.score>=1).map(x=>x.c);
  const compPool = (compTop.length>=6? compTop : compCandidates.map(x=>x.c));
  const compNames = pickN(compPool.filter(c=>normalizeAnswer(c.name)!==chosen.norm.composer).map(c=>c.name), 3, rnd);

  const gameCandidates = pools.games
    .map(g => ({ g, score: (g.platform===targetPlat?2:0) + (targetDec && decade(g.year)===targetDec ? 1:0) }))
    .sort((a,b)=> b.score-a.score);
  const gameTop = gameCandidates.filter(x=>x.score>=1).map(x=>x.g);
  const gamePool = (gameTop.length>=6? gameTop : gameCandidates.map(x=>x.g));
  const gameNames = pickN(gamePool.filter(g=>normalizeAnswer(g.name)!==chosen.norm.game).map(g=>g.name), 3, rnd);

  return {
    composer: shuffle([chosen.composer, ...compNames], rnd),
    game: shuffle([chosen.game, ...gameNames], rnd),
  };
}
function shuffle(arr, rnd){ const a=[...arr]; for(let i=a.length-1;i>0;i--){ const j=Math.floor(rnd()* (i+1)); [a[i],a[j]]=[a[j],a[i]];} return a; }

function main(){
  const { input, date, output, withChoices, datasetPath } = parseArgs();
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
  if (withChoices){
    try{
      const dataset = readJSON(datasetPath);
      chosen.choices = makeChoices(dataset, chosen, date);
    }catch(e){
      console.warn('[generate-auto] with-choices requested but dataset not available:', e.message);
    }
  }
  auto.by_date[date] = chosen;
  fs.writeFileSync(output, JSON.stringify(auto, null, 2));
  console.log(`[generate-auto] date=${date} saved to ${output}`);
}

if (require.main === module) main();
