#!/usr/bin/env node
'use strict';
/**
 * Lightweight validator for authoring pipeline outputs.
 * - Validate JSONL candidates (structure, required fields, uniqueness)
 * - Validate daily_auto.json (structure, choices include canonical, media sanity)
 * No external deps; CI-friendly.
 */
const fs = require('fs');

function readJSON(p){ return JSON.parse(fs.readFileSync(p,'utf-8')); }
function exists(p){ try{ fs.accessSync(p); return true; }catch{ return false; } }

function readJSONL(p){
  const out = [];
  const txt = fs.readFileSync(p,'utf-8');
  for (const raw of txt.split(/\r?\n/)){
    const s = raw.trim();
    if (!s) continue;
    try{
      out.push(JSON.parse(s));
    }catch(e){
      throw new Error(`Invalid JSONL line: ${s.slice(0,200)}`);
    }
  }
  return out;
}

function isNonEmptyStr(x){ return typeof x==='string' && x.trim().length>0; }
function isValidDateKey(k){ return /^\d{4}-\d{2}-\d{2}$/.test(k); }

function checkMedia(m){
  if (m == null) return null;
  const errs = [];
  const prov = m.provider;
  if (!isNonEmptyStr(prov) || !['youtube','apple','auto'].includes(prov)){
    errs.push('media.provider invalid');
  }
  if (!isNonEmptyStr(m.id)) errs.push('media.id missing');
  if (m.start != null){
    if (typeof m.start !== 'number' || !(m.start>=0) || !(m.start < 36000)) errs.push('media.start out of range');
  }
  if (m.duration != null){
    if (typeof m.duration !== 'number' || !(m.duration>0) || !(m.duration < 7200)) errs.push('media.duration out of range');
  }
  return errs.length ? errs : null;
}

function validateCandidates(file){
  if (!exists(file)) return { skipped:true, summary:'candidates file not found' };
  const seen = new Set();
  let n=0, errors=[];
  for (const c of readJSONL(file)){
    n++;
    if (!isNonEmptyStr(c.title)) errors.push(`[c${n}] title missing`);
    if (!isNonEmptyStr(c.game)) errors.push(`[c${n}] game missing`);
    if (!isNonEmptyStr(c.composer)) errors.push(`[c${n}] composer missing`);
    if (!c.norm || !isNonEmptyStr(c.norm.title) || !isNonEmptyStr(c.norm.game) || !isNonEmptyStr(c.norm.composer)){
      errors.push(`[c${n}] norm.* missing`);
    }
    const key = c.norm ? `${c.norm.title}|${c.norm.game}|${c.norm.composer}` : '';
    if (key && seen.has(key)) errors.push(`[c${n}] duplicate key ${key}`);
    seen.add(key);
    const merrs = checkMedia(c.media);
    if (merrs) errors.push(`[c${n}] `+merrs.join(', '));
  }
  return { count:n, errors };
}

function validateDailyAuto(file){
  if (!exists(file)) return { skipped:true, summary:'daily_auto.json not found' };
  const j = readJSON(file);
  const by = j.by_date || {};
  const dates = Object.keys(by);
  const errors = [];
  let choicesOK=0, mediaOK=0;
  for (const d of dates){
    if (!isValidDateKey(d)) errors.push(`[by_date.${d}] invalid date key`);
    const v = by[d] || {};
    if (!isNonEmptyStr(v.title)) errors.push(`[${d}] title missing`);
    if (!isNonEmptyStr(v.game)) errors.push(`[${d}] game missing`);
    if (!isNonEmptyStr(v.composer)) errors.push(`[${d}] composer missing`);
    if (!v.norm || !isNonEmptyStr(v.norm.title) || !isNonEmptyStr(v.norm.game) || !isNonEmptyStr(v.norm.composer)){
      errors.push(`[${d}] norm.* missing`);
    }
    if (v.choices && typeof v.choices === 'object'){
      const comp = Array.isArray(v.choices.composer) ? v.choices.composer : [];
      const game = Array.isArray(v.choices.game) ? v.choices.game : [];
      if (comp.length>0 && !comp.includes(v.composer)) errors.push(`[${d}] choices.composer must include canonical composer`);
      if (game.length>0 && !game.includes(v.game)) errors.push(`[${d}] choices.game must include canonical game`);
      if (comp.length>0 || game.length>0) choicesOK++;
    }
    const merrs = checkMedia(v.media);
    if (merrs) errors.push(`[${d}] `+merrs.join(', '));
    else if (v.media) mediaOK++;
    if (v.difficulty!=null && typeof v.difficulty !== 'number'){
      errors.push(`[${d}] difficulty must be a number`);
    }
  }
  return { dates: dates.length, choicesOK, mediaOK, errors };
}

(function main(){
  try{
    const cand = validateCandidates('public/app/daily_candidates.jsonl');
    const auto = validateDailyAuto('public/app/daily_auto.json');
    const lines = [];
    lines.push('## Authoring validation summary');
    if (!cand.skipped) lines.push(`- candidates: ${cand.count} lines, errors=${cand.errors.length}`);
    else lines.push(`- candidates: (skipped) ${cand.summary}`);
    if (!auto.skipped) lines.push(`- daily_auto: ${auto.dates} dates, choicesOK=${auto.choicesOK}, mediaOK=${auto.mediaOK}, errors=${auto.errors.length}`);
    else lines.push(`- daily_auto: (skipped) ${auto.summary}`);
    const allErrs = [...(cand.errors||[]), ...((auto.errors)||[])];
    if (allErrs.length>0){
      lines.push('\n### Errors');
      for (const e of allErrs.slice(0,200)) lines.push(`- ${e}`);
    }
    console.log(lines.join('\n'));
    if (allErrs.length>0) process.exit(1);
  }catch(e){
    console.error(e.stack||String(e));
    process.exit(1);
  }
})();
