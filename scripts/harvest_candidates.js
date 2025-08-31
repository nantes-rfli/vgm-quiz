#!/usr/bin/env node
'use strict';
/**
 * Harvest daily candidates from current dataset (skeleton).
 * - Default source: public/build/dataset.json
 * - Output: JSON Lines (one candidate per line)
 * - Non-destructive: media is optional; duplicates removed by normalized key
 */
const fs = require('fs');
const path = require('path');
const { normalizeAnswer } = require('./pipeline/normalize');

function readJSON(p){ return JSON.parse(fs.readFileSync(p,'utf-8')); }
function ensureDir(dir){ fs.mkdirSync(dir, { recursive:true }); }

function parseArgs(){
  const args = process.argv.slice(2);
  const outIdx = args.indexOf('--out');
  const out = outIdx>=0 ? args[outIdx+1] : 'public/app/daily_candidates.jsonl';
  const srcIdx = args.indexOf('--src');
  const src = srcIdx>=0 ? args[srcIdx+1] : 'public/build/dataset.json';
  return { out, src };
}

function toCandidate(rec){
  const title = rec.title || rec.track || '';
  const game  = rec.game  || '';
  const composer = rec.composer || '';
  const platform = rec.platform || rec.system || null;
  const year = rec.year || null;
  const norm = {
    title: normalizeAnswer(title),
    game: normalizeAnswer(game),
    composer: normalizeAnswer(composer)
  };
  return {
    title, game, composer, platform, year,
    media: null, // fill later (youtube/appleMusic) — default-off
    source: 'dataset',
    norm
  };
}

function main(){
  const { out, src } = parseArgs();
  if(!fs.existsSync(src)){
    console.error(`[harvest] source not found: ${src}`);
    process.exit(1);
  }
  const dataset = readJSON(src);
  const list = Array.isArray(dataset) ? dataset : (dataset.tracks || []);
  const seen = new Set();
  const outDir = path.dirname(out);
  ensureDir(outDir);
  const ws = fs.createWriteStream(out, { encoding:'utf-8' });
  let kept = 0, total = 0;
  for(const rec of list){
    total++;
    const c = toCandidate(rec);
    const key = `${c.norm.title}|${c.norm.game}|${c.norm.composer}`;
    if(!c.norm.title || !c.norm.game || !c.norm.composer) continue;
    if(seen.has(key)) continue;
    seen.add(key);
    ws.write(JSON.stringify(c) + '\n');
    kept++;
  }
  ws.end();
  console.log(`[harvest] input=${total}, unique=${kept}, out=${out}`);
}

if (require.main === module) main();
