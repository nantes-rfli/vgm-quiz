#!/usr/bin/env node
/**
 * Append provenance coverage KPI to $GITHUB_STEP_SUMMARY and console.
 * Usage:
 *  - JSONL: node scripts/kpi/append_summary_provenance.mjs --jsonl public/app/daily_candidates.jsonl
 *  - JSON : node scripts/kpi/append_summary_provenance.mjs --json build/daily_today.json
 */
import fs from 'node:fs';

function parseArgs(){
  const a=process.argv.slice(2);
  const j=a.indexOf('--jsonl'); const jl=j>=0 ? a[j+1] : null;
  const k=a.indexOf('--json');  const js=k>=0 ? a[k+1] : null;
  if (!jl && !js){ console.log('::warning::provenance-kpi: no input specified'); }
  return { jsonl: jl, json: js };
}
function readJSONL(p){
  if (!p || !fs.existsSync(p)) return [];
  return fs.readFileSync(p,'utf-8').split(/\r?\n/).filter(Boolean).map(l=>{try{return JSON.parse(l)}catch{return null}}).filter(Boolean);
}
function readJSON(p){
  if (!p || !fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p,'utf-8'));
}
function hasProv(obj){
  const pv = obj?.provenance || obj?.meta?.provenance;
  if (!pv || typeof pv!=='object') return false;
  return !!(pv.provider && pv.id && pv.collected_at);
}

function kpiFromJSONL(path){
  const items = readJSONL(path);
  const total = items.length || 1;
  const have = items.filter(hasProv).length;
  const pct = (100*have/total).toFixed(1);
  return { kind:'jsonl', path, total, with_provenance: have, coverage:`${pct}%` };
}
function deepFindItem(node, depth=0){
  if (node==null || depth>4) return null;
  if (node.item && typeof node.item==='object') return node.item;
  if (node.flat && typeof node.flat==='object') return node.flat;
  if (node.items && Array.isArray(node.items)) return node.items[0];
  if (node.by_date && typeof node.by_date==='object'){
    const keys = Object.keys(node.by_date).sort();
    const last = keys[keys.length-1];
    return deepFindItem(node.by_date[last], depth+1) || node.by_date[last];
  }
  for (const v of Object.values(node)){
    if (typeof v==='object'){ const f=deepFindItem(v, depth+1); if (f) return f; }
  }
  return null;
}
function kpiFromJSON(path){
  const obj = readJSON(path) || {};
  const it = deepFindItem(obj) || obj.item || obj;
  const ok = hasProv(it);
  return { kind:'json', path, has_provenance: ok };
}

function emit(title, lines){
  const SUM = process.env.GITHUB_STEP_SUMMARY;
  const body = [ `### ${title}`, ...lines ].join('\n');
  if (SUM) fs.appendFileSync(SUM, body+'\n');
  console.log(body);
}

function main(){
  const { jsonl, json } = parseArgs();
  if (jsonl){
    const s = kpiFromJSONL(jsonl);
    emit('KPI (provenance, candidates)', [
      `- file: ${s.path}`,
      `- total: ${s.total}, with_provenance: ${s.with_provenance} (${s.coverage})`
    ]);
  }
  if (json){
    const s = kpiFromJSON(json);
    emit('KPI (provenance, authoring today)', [
      `- file: ${s.path}`,
      `- has_provenance: ${s.has_provenance}`
    ]);
  }
}
main();

