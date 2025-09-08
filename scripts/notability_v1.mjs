#!/usr/bin/env node
/**
 * Notability v1 — simple score & banding for candidates JSONL
 * Writes to: obj.meta.notability = {score, band}  (FLAT; no extra nesting)
 * Also flattens legacy shape: if obj.meta.notability.notability exists, it is replaced.
 */
import fs from 'node:fs';
import path from 'node:path';

const IN = process.env.NOTAB_IN || 'public/app/daily_candidates.jsonl';
const OUT = process.env.NOTAB_OUT || IN;

const W_OFFICIAL = Number(process.env.NOTAB_W_OFFICIAL ?? '0.5');
const W_ALIAS    = Number(process.env.NOTAB_W_ALIAS ?? '0.3');
const W_SIGNAL   = Number(process.env.NOTAB_W_SIGNAL ?? '0.2');
const TH_HIGH    = Number(process.env.NOTAB_TH_HIGH ?? '0.67');
const TH_LOW     = Number(process.env.NOTAB_TH_LOW  ?? '0.33');

function readJSONL(file){
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file,'utf-8').split(/\r?\n/).filter(Boolean).map(l=>{try{return JSON.parse(l)}catch{return null}}).filter(Boolean);
}
function writeJSONL(file, arr){
  fs.mkdirSync(path.dirname(file), {recursive:true});
  fs.writeFileSync(file, arr.map(o=>JSON.stringify(o)).join('\n')+'\n');
}

function aliasCount(ans){
  if (!ans) return 0;
  if (Array.isArray(ans)) return ans.length;
  if (typeof ans==='object' && Array.isArray(ans.acceptables)) return ans.acceptables.length;
  return 0;
}
function aliasNorm(c){ const cap=5; return Math.max(0, Math.min(1, c/cap)); }
function isOfficial(o){ const m=o?.media; return (m?.apple && (m.apple.embedUrl||m.apple.url||m.apple.previewUrl)) ? 1 : 0; }
function providerSignal(o){
  const m=o?.media;
  if (m?.apple) return 1.0;
  if (m?.provider==='youtube' && m.id) return 0.6;
  if (!m) return 0.2;
  return 0.4;
}

function flattenLegacyNotability(o){
  const meta = o.meta && typeof o.meta==='object' ? o.meta : (o.meta={});
  const nb = meta.notability;
  if (nb && typeof nb==='object' && nb.notability && typeof nb.notability==='object'){
    meta.notability = nb.notability; // flatten
  }
  return meta;
}

function setNotability(o, score, band){
  const meta = flattenLegacyNotability(o);
  meta.notability = { score: Number(score.toFixed(3)), band };
}

function main(){
  const arr = readJSONL(IN);
  let high=0, med=0, low=0;
  for (const o of arr){
    const official = isOfficial(o);
    const aliases = aliasCount(o?.answers?.acceptables ?? o?.answers);
    const aNorm = aliasNorm(aliases);
    const pSig = providerSignal(o);
    let score = W_OFFICIAL*official + W_ALIAS*aNorm + W_SIGNAL*pSig;
    score = Math.max(0, Math.min(1, score));
    let band = 'med';
    if (score >= TH_HIGH) band = 'high'; else if (score <= TH_LOW) band = 'low';
    setNotability(o, score, band);
    if (band==='high') high++; else if (band==='low') low++; else med++;
  }
  writeJSONL(OUT, arr);
  const total = arr.length || 1;
  const lines = [];
  lines.push('### KPI (notability v1)');
  lines.push(`- bands: high=${high} (${((100*high)/total).toFixed(1)}%), med=${med}, low=${low} (${((100*low)/total).toFixed(1)}%)`);
  const SUM = process.env.GITHUB_STEP_SUMMARY;
  if (SUM) fs.appendFileSync(SUM, lines.join('\n')+'\n');
  console.log(lines.join('\n'));
}
main();
