#!/usr/bin/env node
/**
 * Notability v1 — simple score & banding for candidates JSONL
 * Features (0..1): official(apple) / alias_norm / provider_signal
 * Score = 0.5*official + 0.3*alias_norm + 0.2*provider_signal
 * Bands: high>=0.67, low<=0.33, else med
 * Input:  public/app/daily_candidates.jsonl
 * Output: in-place enrichment: item.meta.notability = {score, band}
 * Summary: prints band ratios to $GITHUB_STEP_SUMMARY and console
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
  // supports: {acceptables:[]}, array, or string
  if (Array.isArray(ans)) return ans.length;
  if (typeof ans==='object' && Array.isArray(ans.acceptables)) return ans.acceptables.length;
  return 0;
}
function aliasNorm(c){
  // cap at 5 -> 1.0
  const cap = 5;
  return Math.max(0, Math.min(1, c / cap));
}
function isOfficial(o){
  const m = o?.media;
  if (m?.apple && (m.apple.embedUrl || m.apple.url || m.apple.previewUrl)) return 1;
  return 0;
}
function providerSignal(o){
  const m=o?.media;
  if (m?.apple) return 1.0;
  if (m?.provider==='youtube' && m.id) return 0.6;
  if (!m) return 0.2;
  return 0.4;
}
function ensureMeta(o){ if (!o.meta) o.meta={}; if (!o.meta.notability) o.meta.notability={}; return o.meta.notability; }

function main(){
  const arr = readJSONL(IN);
  let high=0, med=0, low=0;
  for (const o of arr){
    const official = isOfficial(o);
    const aliases = aliasCount(o?.answers?.acceptables ?? o?.answers);
    const aNorm = aliasNorm(aliases);
    const pSig = providerSignal(o);
    let score = W_OFFICIAL*official + W_ALIAS*aNorm + W_SIGNAL*pSig;
    // bound
    score = Math.max(0, Math.min(1, score));
    let band = 'med';
    if (score >= TH_HIGH) band = 'high'; else if (score <= TH_LOW) band = 'low';
    const meta = ensureMeta(o);
    meta.notability = { score: Number(score.toFixed(3)), band };
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

