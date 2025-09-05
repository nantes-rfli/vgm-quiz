#!/usr/bin/env node
/**
 * v1.8 schema check (soft by default)
 * - Validates shape of ONE daily item.
 * - Sources (in order):
 *   1) build/daily_today.json
 *      - Accepts either {date,item} or flattened {date, ...item} or just item
 *   2) public/app/daily_auto.json (by_date) -> latest date
 * - Exit code:
 *   - default: 0 even if warnings (errors -> 1 only when SCHEMA_CHECK_STRICT=true)
 */
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const candidates = [
  path.resolve(__dirname, '../build/daily_today.json'),
  path.resolve(__dirname, '../public/app/daily_auto.json'),
];

const strict = (process.env.SCHEMA_CHECK_STRICT || '').toLowerCase() === 'true';

function annotate(msg, level='error'){
  const tag = level === 'warning' ? '::warning::' : '::error::';
  console.log(`${tag}${msg}`);
}

async function readJson(p){
  const text = await readFile(p, 'utf-8');
  return JSON.parse(text);
}

function unwrapDailyToday(obj){
  // Supports {date,item}, {date,...item}, or plain item
  if (!obj || typeof obj !== 'object') return { date: null, item: null };
  if (Object.prototype.hasOwnProperty.call(obj, 'item')) {
    const { date = null, item } = obj;
    return { date, item };
  }
  // if looks like an item (has some known keys), treat as flattened
  const keys = Object.keys(obj);
  const likelyItem = ['title','game','composer','media','answers','track'].some(k => keys.includes(k));
  if (likelyItem) {
    const { date = null, ...rest } = obj;
    return { date, item: rest };
  }
  return { date: null, item: null };
}

function latestFromDailyAuto(obj){
  if (!obj || typeof obj !== 'object' || !obj.by_date) return { date: null, item: null };
  const dates = Object.keys(obj.by_date).sort();
  const date = dates[dates.length - 1] || null;
  const item = date ? obj.by_date[date] : null;
  return { date, item };
}

function isNonEmptyString(v){ return typeof v === 'string' && v.trim().length > 0; }
function getComposer(item){
  const t = item.track && item.track.composer;
  const c = item.composer;
  if (Array.isArray(t) && t.length) return t.join(', ');
  if (isNonEmptyString(t)) return t;
  if (Array.isArray(c) && c.length) return c.join(', ');
  if (isNonEmptyString(c)) return c;
  return null;
}

function validate(date, item){
  const errors = [];
  const warnings = [];

  if (!item || typeof item !== 'object') {
    errors.push('schema: no item in source');
    return { errors, warnings };
  }

  if (!isNonEmptyString(item.title)) errors.push('schema title missing/non-string');
  if (!isNonEmptyString(item.game)) errors.push('schema game missing/non-string');

  const comp = getComposer(item);
  if (!isNonEmptyString(comp)) errors.push('schema track.composer missing/non-string');

  const media = item.media || {};
  if (!isNonEmptyString(media.provider)) errors.push('schema media.provider missing/non-string');
  if (!isNonEmptyString(media.id)) errors.push('schema media.id missing/non-string');

  const ans = item.answers || {};
  if (!isNonEmptyString(ans.canonical)) errors.push('schema answers.canonical missing/empty');

  const d = item.difficulty;
  if (!(typeof d === 'number' && d >= 0 && d <= 1)) {
    warnings.push('schema difficulty missing or out of range [0,1]');
  }

  return { errors, warnings };
}

async function main(){
  let chosen = null;
  let src = null;
  let date = null;
  let item = null;

  // 1) daily_today.json
  if (existsSync(candidates[0])) {
    src = candidates[0];
    const obj = await readJson(src);
    const u = unwrapDailyToday(obj);
    date = u.date;
    item = u.item;
    if (!item) {
      console.log('Warning: build/daily_today.json present but could not find an item; falling back to public/app/daily_auto.json');
      src = null;
    }
  }

  // 2) daily_auto.json (by_date)
  if (!src) {
    src = candidates[1];
    const obj = await readJson(src);
    const u = latestFromDailyAuto(obj);
    date = u.date;
    item = u.item;
  }

  const { errors, warnings } = validate(date, item);

  // emit annotations
  warnings.forEach(w => annotate(w, 'warning'));
  errors.forEach(e => annotate(e, 'error'));

  if (errors.length) {
    console.log(`schema: violations=${errors.length} file=${src}`);
    process.exit(strict ? 1 : 0);
  } else {
    const d = date || 'unknown-date';
    console.log(`schema: OK file=${src} date=${d}`);
    process.exit(0);
  }
}

main().catch(e => {
  annotate(`unhandled error: ${e?.stack || e}`, 'error');
  process.exit(1);
});

