#!/usr/bin/env node
/**
 * validate_authoring_schema.mjs (v1.8+)
 * - Validates the "today" daily item shape.
 * - Sources (in order):
 *    1) build/daily_today.json  ({ date, item })
 *    2) public/app/daily_auto.json (by_date)
 * - Behavior:
 *    * Required fields -> error
 *    * difficulty in [0,1] -> ok; missing/out-of-range -> warning (does not fail)
 * - Exit:
 *    * default: strict (fail on errors); env SCHEMA_CHECK_STRICT=false to soften

 */
import fs from 'node:fs/promises';
import fss from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function annotate(kind, msg){
  const k = kind.toLowerCase();
  const tag = k === 'error' ? '::error::' : '::warning::';
  console.log(tag + msg);
}

function isStr(x){ return typeof x === 'string' && x.trim().length > 0; }
function isNum(x){ return typeof x === 'number' && Number.isFinite(x); }

function pickLatest(by_date){
  const entries = Object.entries(by_date || {})
    .filter(([d,v]) => v && typeof v === 'object' && isStr(d))
    .sort((a,b) => a[0].localeCompare(b[0]));
  if (!entries.length) return null;
  const [date, item] = entries[entries.length-1];
  return { date, item };
}

async function readJsonIfExists(p){
  try {
    if (!fss.existsSync(p)) return null;
    const s = await fs.readFile(p, 'utf-8');
    return JSON.parse(s);
  } catch (e) {
    annotate('error', `failed to read JSON ${p}: ${e?.message || e}`);
    return null;
  }
}

async function loadToday(){
  const build = path.resolve(__dirname, '../build/daily_today.json');
  const auto  = path.resolve(__dirname, '../public/app/daily_auto.json');

  // 1) build/daily_today.json
  const slim = await readJsonIfExists(build);
  if (slim) {
    // { date, item } shape
    if (slim.item && typeof slim.item === 'object') {
      return { src: build, date: slim.date, item: slim.item };
    }
    // Some older shapes might already be unwrapped
    if (slim.by_date && typeof slim.by_date === 'object') {
      const p = pickLatest(slim.by_date);
      if (p) return { src: build, date: p.date, item: p.item };
    }
    // If it already looks like an item, accept
    if (slim.title || slim.game || slim.media) {
      return { src: build, date: null, item: slim };
    }
    // If present but unusable, continue to fallback
    annotate('warning', `build/daily_today.json present but could not find an item; falling back to public/app/daily_auto.json`);
  }

  // 2) public/app/daily_auto.json
  const autoObj = await readJsonIfExists(auto);
  if (autoObj && autoObj.by_date && typeof autoObj.by_date === 'object') {
    const p = pickLatest(autoObj.by_date);
    if (p) return { src: auto, date: p.date, item: p.item };
  }

  return { src: build, date: null, item: null };
}

function validate(item){
  const errors = [];
  const warnings = [];

  if (!item || typeof item !== 'object') {
    errors.push('no item');
    return { errors, warnings };
  }

  // accept composer as either item.composer or item.track.composer
  const composer = isStr(item.composer) ? item.composer
                   : (item.track && isStr(item.track.composer) ? item.track.composer : null);

  // required string fields
  if (!isStr(item.title)) errors.push('schema title missing/non-string');
  if (!isStr(item.game)) errors.push('schema game missing/non-string');
  if (!composer) errors.push('schema track.composer missing/non-string');

  // media
  const m = item.media || {};
  if (!isStr(m.provider)) errors.push('schema media.provider missing/non-string');
  if (!isStr(m.id))       errors.push('schema media.id missing/non-string');

  // answers.canonical
  const ans = item.answers || {};
  if (!isStr(ans.canonical)) errors.push('schema answers.canonical missing/empty');

  // difficulty -> warning only
  if (!(isNum(item.difficulty) && item.difficulty >= 0 && item.difficulty <= 1)){
    warnings.push('schema difficulty missing or out of range [0,1]');
  }

  return { errors, warnings };
}

async function main(){
  const strict = String(process.env.SCHEMA_CHECK_STRICT || 'true').toLowerCase() !== 'false';
  const { src, date, item } = await loadToday();

  const { errors, warnings } = validate(item);
  warnings.forEach(w => annotate('warning', w));

  if (errors.length){
    errors.forEach(e => annotate('error', e));
    console.log(`schema: violations=${errors.length} file=${src}`);
    process.exit(strict ? 1 : 0);
  }

  console.log(`schema: OK file=${src}${date ? ` date=${date}` : ''}`);
  process.exit(0);
}

main().catch(e=>{
  annotate('error', `unhandled error: ${e?.stack || e}`);
  process.exit(1);
});

