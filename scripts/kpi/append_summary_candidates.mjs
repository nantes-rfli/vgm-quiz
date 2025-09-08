#!/usr/bin/env node
/**
 * Append KPI summary for candidates JSONL to $GITHUB_STEP_SUMMARY
 * Usage: node scripts/kpi/append_summary_candidates.mjs --in public/app/daily_candidates.jsonl --label "pre-dedup"
 */
import fs from 'node:fs';

const args = process.argv.slice(2);
let IN = 'public/app/daily_candidates.jsonl';
let LABEL = 'pre-dedup';
for (let i=0;i<args.length;i++){
  if (args[i]==='--in') IN = args[i+1];
  if (args[i]==='--label') LABEL = args[i+1];
}

function readJSONL(file){
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file,'utf-8').split(/\r?\n/).filter(Boolean).map(l=>{try{return JSON.parse(l)}catch{return null}}).filter(Boolean);
}

function summarize(items){
  const out = { total: items.length, apple:0, youtube:0, null:0, other:0, clip_flags:{} };
  for (const o of items){
    const m = o?.media;
    if (m && typeof m==='object'){
      if (m.apple && typeof m.apple==='object' && (m.apple.embedUrl || m.apple.url || m.apple.previewUrl)){
        out.apple++;
      } else if (m.provider==='youtube' && m.id){
        out.youtube++;
      } else {
        out.other++;
      }
    } else {
      out.null++;
    }
    const flags = (o?.clip?.flags && Array.isArray(o.clip.flags)) ? o.clip.flags : [];
    for (const f of flags){ out.clip_flags[f] = (out.clip_flags[f]||0)+1; }
  }
  return out;
}

function appendSummary(label, s){
  const SUM = process.env.GITHUB_STEP_SUMMARY;
  const lines = [];
  lines.push(`### KPI (candidates) — ${label}`);
  lines.push(`- total: **${s.total}**`);
  lines.push(`- media: apple=${s.apple}, youtube=${s.youtube}, null=${s.null}, other=${s.other}`);
  const fkeys = Object.keys(s.clip_flags);
  if (fkeys.length){
    lines.push(`- clip.flags:`);
    for (const k of fkeys.sort()){
      lines.push(`  - ${k}: ${s.clip_flags[k]}`);
    }
  }
  if (SUM) fs.appendFileSync(SUM, lines.join('\n')+'\n');
  else console.log(lines.join('\n'));
}

const items = readJSONL(IN);
appendSummary(LABEL, summarize(items));
