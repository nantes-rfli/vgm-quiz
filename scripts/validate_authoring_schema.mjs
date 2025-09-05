#!/usr/bin/env node
/**
 * v1.8 schema check (strict core, soft difficulty)
 * - Validates shape of a single daily item (today) using lightweight checks.
 * - Sources: prefer build/daily_today.json ({date,item}); fallback to public/app/daily_auto.json (by_date or array)
 * - Exit 1 on CORE violations (title/game/track.composer/media.provider/id/answers.canonical).
 * - 'difficulty' is **warning-only** (missing or out-of-range does not fail the job).
 */
import { readFile, access } from 'fs/promises';
import { constants as fsconst } from 'fs';
import path from 'path';
import url from 'url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

const candidates = [
  path.resolve(__dirname, '../build/daily_today.json'),
  path.resolve(__dirname, '../public/app/daily_auto.json')
];

function annotate(msg){ console.log(`::warning::${msg}`); }
function errornote(msg){ console.log(`::error::${msg}`); }

function isNonEmptyString(x){ return typeof x === 'string' && x.trim().length > 0; }
function isStringArray(x){ return Array.isArray(x) && x.length > 0 && x.every(isNonEmptyString); }

async function exists(p){
  try { await access(p, fsconst.R_OK); return true; } catch { return false; }
}

function unwrapEnvelope(x){
  // Accept shapes: {date,item}, {date, ...flat}, flat item, by_date map, array
  if (x && typeof x === 'object') {
    if (x.item && (x.date || x.item.date)) {
      return { date: x.date || x.item.date, item: x.item };
    }
    if (x.date && (x.title || x.game || x.media)) {
      const { date, ...rest } = x;
      return { date, item: rest };
    }
    if (x.by_date && typeof x.by_date === 'object') {
      const dates = Object.keys(x.by_date).sort();
      const date = dates[dates.length - 1];
      return { date, item: x.by_date[date] };
    }
    // If it looks like a single flat item
    if (x.title || x.game || x.media) {
      return { date: null, item: x };
    }
    // If it's an array, pick last
    if (Array.isArray(x) && x.length) {
      return { date: null, item: x[x.length - 1] };
    }
  }
  return { date: null, item: null };
}

async function loadSource(){
  for (const p of candidates){
    if (await exists(p)){
      const txt = await readFile(p, 'utf-8');
      let data;
      try { data = JSON.parse(txt); } catch (e) {
        errornote(`schema: JSON parse error in ${p}: ${e.message}`);
        process.exit(1);
      }
      return { src: p, ...unwrapEnvelope(data) };
    }
  }
  errornote('schema: no source found (build/daily_today.json nor public/app/daily_auto.json)');
  process.exit(1);
}

function validate(item){
  const errors = [];
  const warnings = [];

  if (!isNonEmptyString(item?.title)) errors.push('schema title missing/non-string');
  if (!isNonEmptyString(item?.game)) errors.push('schema game missing/non-string');
  if (!isNonEmptyString(item?.track?.composer)) errors.push('schema track.composer missing/non-string');

  const provider = item?.media?.provider;
  const mid = item?.media?.id;
  if (!isNonEmptyString(provider) || !isNonEmptyString(mid)) {
    errors.push('schema media.provider/id missing/non-string');
  }

  const ac = item?.answers?.canonical;
  if (!(isNonEmptyString(ac) || isStringArray(ac))) {
    errors.push('schema answers.canonical missing/empty');
  }

  const diff = item?.difficulty;
  if (!(typeof diff === 'number' && diff >= 0 && diff <= 1)) {
    warnings.push('schema difficulty missing or out of range [0,1]');
  }
  return { errors, warnings };
}

async function main(){
  const { src, date, item } = await loadSource();
  if (!item) {
    errornote(`schema: no item in ${src}`);
    process.exit(1);
  }
  const { errors, warnings } = validate(item);
  for (const w of warnings) annotate(w);
  if (errors.length) {
    for (const e of errors) errornote(e);
    console.log(`schema: violations=${errors.length} file=${src}`);
    process.exit(1);
  } else {
    console.log(`schema: OK file=${src}`);
    process.exit(0);
  }
}

main().catch(e => {
  errornote(`unhandled error: ${e?.stack || e}`);
  process.exit(1);
});
