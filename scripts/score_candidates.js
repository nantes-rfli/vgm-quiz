#!/usr/bin/env node
'use strict';
/**
 * Read JSONL candidates, attach heuristic difficulty and clip-start placeholder.
 * Output JSONL with `difficulty` and `media.start` (if media exists).
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { buildFreq, scoreCandidate } = require('./pipeline/difficulty');

function parseArgs(){
  const args = process.argv.slice(2);
  const i = args.indexOf('--in');  const input = i>=0 ? args[i+1] : 'public/app/daily_candidates.jsonl';
  const o = args.indexOf('--out'); const output = o>=0 ? args[o+1] : 'public/app/daily_candidates_scored.jsonl';
  return { input, output };
}

async function readJSONL(p){
  const rs = fs.createReadStream(p, 'utf-8');
  const rl = readline.createInterface({ input: rs, crlfDelay: Infinity });
  const rows = [];
  for await (const line of rl){
    const s = line.trim(); if (!s) continue;
    try { rows.push(JSON.parse(s)); } catch {}
  }
  return rows;
}

function ensureDir(dir){ fs.mkdirSync(dir, { recursive:true }); }

async function main(){
  const { input, output } = parseArgs();
  if(!fs.existsSync(input)){ console.error(`[score] not found: ${input}`); process.exit(1); }
  const cands = await readJSONL(input);
  const freq = buildFreq(cands);
  const outDir = path.dirname(output); ensureDir(outDir);
  const ws = fs.createWriteStream(output, 'utf-8');
  let n=0;
  for(const c of cands){
    const diff = scoreCandidate(c, freq);
    if (c.media && typeof c.media.start !== 'number'){
      // placeholder: neutral 45s. Fine until we hook real analysis.
      c.media.start = 45;
    }
    c.difficulty = diff;
    ws.write(JSON.stringify(c) + '\n');
    n++;
  }
  ws.end();
  console.log(`[score] scored=${n}, out=${output}`);
}

if (require.main === module) main();

