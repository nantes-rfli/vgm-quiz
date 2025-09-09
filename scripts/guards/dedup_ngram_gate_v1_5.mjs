#!/usr/bin/env node
/**
 * De-dup v1.5 ゲート（任意）
 * - JSONL（daily_candidates.jsonl）を読み、3-gram Jaccard θ を算出。
 * - --fail-threshold に到達するペアが1つでもあれば非0終了（CIを落とす）。
 * 使い方:
 *   node scripts/guards/dedup_ngram_gate_v1_5.mjs --in public/app/daily_candidates.jsonl --fail-threshold 0.85
 */
import fs from 'node:fs';

function readJSONL(p){
  const s = fs.readFileSync(p,'utf8').split(/\r?\n/).filter(Boolean);
  return s.map(l=>JSON.parse(l));
}
function norm(s){
  return String(s||'').normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim();
}
function keyOf(it){
  const t = norm(it.title);
  const g = norm(it.game?.name ?? it.game);
  const c = norm(it.composer ?? it.track?.composer);
  const a = norm(it.answers?.canonical);
  return [t,g,c,a].filter(Boolean).join(' | ');
}
function shingles(s, n=3){
  const z = s.replace(/\s+/g,'');
  const out = new Set();
  for (let i=0;i<=Math.max(0,z.length-n);i++) out.add(z.slice(i,i+n));
  return out;
}
function jaccard(a,b){
  const A = shingles(a), B = shingles(b);
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  const uni = A.size + B.size - inter;
  return uni ? inter/uni : 0;
}
function arg(flag, def){
  const i = process.argv.indexOf(flag);
  return (i>=0 && i+1<process.argv.length) ? process.argv[i+1] : def;
}
const IN  = arg('--in','public/app/daily_candidates.jsonl');
const THs = (arg('--fail-threshold','')||'').split(',').map(x=>Number(x)).filter(x=>!Number.isNaN(x));
const FAIL = THs.length? Math.max(...THs) : Number.NaN; // 単一値を想定（複数与えられたら最大値）

const items = readJSONL(IN);
if (items.length < 2 || Number.isNaN(FAIL)) {
  console.log('Dedup gate: skipped (pairs<1 or no --fail-threshold).');
  process.exit(0);
}
const keys = items.map(keyOf);
let worst = {theta:-1,i:-1,j:-1};
for (let i=0;i<keys.length;i++){
  for (let j=i+1;j<keys.length;j++){
    const theta = jaccard(keys[i],keys[j]);
    if (theta > worst.theta) worst = {theta,i,j};
    if (theta >= FAIL){
      console.error(`Dedup gate: FAIL θ=${theta.toFixed(3)} >= ${FAIL} :: [${i}] ${keys[i]}  <->  [${j}] ${keys[j]}`);
      process.exit(1);
    }
  }
}
console.log(`Dedup gate: OK (worst θ=${worst.theta.toFixed(3)} @ [${worst.i}]~[${worst.j}])`);
process.exit(0);
