#!/usr/bin/env node
/**
 * Append Gate dry-run KPI summary for JSONL proposals to $GITHUB_STEP_SUMMARY.
 * - Tries to read score from obj.score / obj.meta.score / obj.kpi.score
 * - If not present, scoring-based metrics are marked as N/A
 */
import fs from 'node:fs';
import path from 'node:path';

function readJsonl(file){
  const out=[];
  if (!fs.existsSync(file)) return out;
  const txt = fs.readFileSync(file,'utf8');
  for (const line of txt.split('\n')){
    const s = line.trim();
    if (!s) continue;
    try { out.push(JSON.parse(s)); } catch {}
  }
  return out;
}

function avg(arr){
  if (!arr.length) return null;
  const s = arr.reduce((a,b)=>a+b,0);
  return s/arr.length;
}

const args = process.argv.slice(2);
let IN = '';
let LABEL = 'gate-dryrun';
let THETA = null;
for (let i=0;i<args.length;i++){
  if (args[i]==='--in') IN = args[i+1];
  if (args[i]==='--label') LABEL = args[i+1];
  if (args[i]==='--threshold') THETA = parseFloat(args[i+1]);
}
if (!IN){
  console.error('usage: append_summary_gate_dryrun.mjs --in <proposals.jsonl> [--threshold <num>] [--label <txt>]');
  process.exit(2);
}

const items = readJsonl(IN);
const N = items.length;
let scores = [];
let providers = {};
let haveScore = false;
let compPresent=0, provPresent=0, titlePresent=0, gamePresent=0;

for (const o of items){
  const score = o.score ?? o?.meta?.score ?? o?.kpi?.score;
  if (typeof score === 'number' && isFinite(score)) { scores.push(score); haveScore=true; }
  const prov = o?.meta?.provenance?.provider ?? o?.provenance?.provider ?? o?.provider;
  if (prov) providers[prov]=(providers[prov]||0)+1;
  if (o?.composer) compPresent++;
  if (o?.title) titlePresent++;
  if (o?.game) gamePresent++;
  if (o?.meta?.provenance || o?.provenance) provPresent++;
}

const meanScore = avg(scores);
let autoAcceptRate = null, rejectRate = null;
if (haveScore && typeof THETA === 'number'){
  const pass = scores.filter(s=>s>=THETA).length;
  autoAcceptRate = N ? pass/N : 0;
  // assume reject as score < 0.50 when available
  const rej = scores.filter(s=>s<0.50).length;
  rejectRate = N ? rej/N : 0;
}

function pct(n){ return (n*100).toFixed(1)+'%'; }

const lines = [];
lines.push(`### Gate dry-run KPI (${LABEL})`);
lines.push('');
lines.push(`- proposals: **${N}**`);
lines.push(`- fields present: title ${pct(titlePresent/N||0)}, game ${pct(gamePresent/N||0)}, composer ${pct(compPresent/N||0)}, provenance ${pct(provPresent/N||0)}`);
if (haveScore){
  if (meanScore!=null) lines.push(`- avg_score: **${meanScore.toFixed(3)}**`);
  if (autoAcceptRate!=null) lines.push(`- auto_accept_rate@θ=${THETA}: **${pct(autoAcceptRate)}**`);
  if (rejectRate!=null) lines.push(`- reject_rate(<0.50): **${pct(rejectRate)}**`);
}else{
  lines.push('- score: N/A（proposals に score が見つかりません）');
}
if (Object.keys(providers).length){
  lines.push('- providers:');
  for (const [p,c] of Object.entries(providers).sort((a,b)=>b[1]-a[1])){
    lines.push(`  - ${p}: ${c}`);
  }
}
const out = lines.join('\n') + '\n';

console.log(out);
const SUM = process.env.GITHUB_STEP_SUMMARY;
if (SUM) fs.appendFileSync(SUM, out);
