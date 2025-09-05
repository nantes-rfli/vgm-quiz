#!/usr/bin/env node
/**
 * v1.8 schema check (soft by default)
 * - Validates shape of ONE daily item.
 * - Sources (priority):
 *   1) build/daily_today.json (accepts {date,item}, {date,...item}, or plain item)
 *   2) public/app/daily_auto.json (by_date -> latest)
 * - Exit 0 by default; set SCHEMA_CHECK_STRICT=true to fail on violations.
 */
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const strict = (process.env.SCHEMA_CHECK_STRICT || '').toLowerCase() === 'true';

function annotate(msg, level='error'){
  const tag = level === 'warning' ? '::warning::' : '::error::';
  console.log(`${tag}${msg}`);
}

async function readJson(p){
  return JSON.parse(await readFile(p, 'utf-8'));
}

function unwrapDaily(obj){
  // {date,item} or {date,...item} or plain item
  if (!obj || typeof obj !== 'object') return { date: null, item: null };
  if ('item' in obj) {
    const { date = null, item } = obj;
    return { date, item };
  }
  const keys = Object.keys(obj);
  const looksLikeItem = ['title','game','composer','media','answers','track'].some(k => keys.includes(k));
  if (looksLikeItem) {
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
  const pToday = path.resolve(__dirname, '../build/daily_today.json');
  const pAuto  = path.resolve(__dirname, '../public/app/daily_auto.json');

  let src = null, date = null, item = null;

  if (existsSync(pToday)) {
    const u = unwrapDaily(await readJson(pToday));
    if (u.item) { src = pToday; ({date,item} = u); }
    else console.log('Warning: build/daily_today.json present but could not find an item; falling back to public/app/daily_auto.json');
  }

  if (!src) {
    src = pAuto;
    const u = latestFromDailyAuto(await readJson(pAuto));
    ({date,item} = u);
  }

  const { errors, warnings } = validate(date, item);
  warnings.forEach(w => annotate(w, 'warning'));
  errors.forEach(e => annotate(e, 'error'));

  if (errors.length) {
    console.log(`schema: violations=${errors.length} file=${src}`);
    process.exit(strict ? 1 : 0);
  } else {
    console.log(`schema: OK file=${src} date=${date||'unknown'}`);
    process.exit(0);
  }
}

main().catch(e => {
  annotate(`unhandled error: ${e?.stack || e}`, 'error');
  process.exit(1);
});
