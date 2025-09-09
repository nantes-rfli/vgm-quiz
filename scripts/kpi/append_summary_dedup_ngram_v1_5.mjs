#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

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
  for (let i=0;i<=Math.max(0,z.length-n);i++){
    out.add(z.slice(i,i+n));
  }
  return out;
}
function jaccard(a,b){
  const A = shingles(a), B = shingles(b);
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  const uni = A.size + B.size - inter;
  return uni ? inter/uni : 0;
}
function parseArg(flag, def){
  const i = process.argv.indexOf(flag);
  if (i>=0 && i+1<process.argv.length) return process.argv[i+1];
  return def;
}
function append(lines){
  const sum = process.env.GITHUB_STEP_SUMMARY;
  if (sum) fs.appendFileSync(sum, lines.join('\n')+'\n');
  console.log(lines.join('\n'));
}

const IN = parseArg('--in','public/app/daily_candidates.jsonl');
const TH = (parseArg('--thresholds','0.7,0.8,0.9')||'').split(',').map(x=>Number(x)).filter(x=>!Number.isNaN(x)).sort((a,b)=>a-b);
const items = readJSONL(IN).slice(0,200);
const keys = items.map(keyOf);
const pairs = [];
for (let i=0;i<keys.length;i++){
  for (let j=i+1;j<keys.length;j++){
    const theta = jaccard(keys[i], keys[j]);
    pairs.push({i,j,theta});
  }
}
pairs.sort((a,b)=>b.theta-a.theta);

const buckets = {};
for (const t of TH){ buckets[t] = pairs.filter(p=>p.theta>=t).length; }
const top = pairs.slice(0,Math.min(5,pairs.length)).map(p=>{
  return `- θ=${p.theta.toFixed(3)} :: [${p.i}] ${keys[p.i]}  <->  [${p.j}] ${keys[p.j]}`;
});

append([
  '### KPI (dedup v1.5 preview)',
  `- file: ${IN}`,
  `- pairs: ${pairs.length}`,
  `- thresholds: ${TH.join(', ')}`,
  ...TH.map(t=>`- θ ≥ ${t}: ${buckets[t]}`),
  top.length ? '- top pairs:\n'+top.join('\n') : '- top pairs: (none)'
]);
