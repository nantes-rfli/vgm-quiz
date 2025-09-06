#!/usr/bin/env node
/**
 * v1.8 schema check (soft by default)
 * - Validates shape of ONE daily item.
 * - Sources (priority):
 *   1) build/daily_today.json (accepts {date,item}, {date,...item}, or plain item)
 *   2) public/app/daily_auto.json (by_date -> latest)  [also unwraps {item: {...}} or {items: [...] }]
 * - Exit 0 by default; set SCHEMA_CHECK_STRICT=true to fail on violations.
 * - Set SCHEMA_CHECK_DEBUG=true to print chosen date & keys.
 * - Set SCHEMA_CHECK_FORCE_DATE=YYYY-MM-DD to force a date from daily_auto.by_date.
 */
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const strict = (process.env.SCHEMA_CHECK_STRICT || '').toLowerCase() === 'true';
const debug  = (process.env.SCHEMA_CHECK_DEBUG  || '').toLowerCase() === 'true';
const forceDate = (process.env.SCHEMA_CHECK_FORCE_DATE || '').trim();

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

function isIsoDateKey(k){ return /^\d{4}-\d{2}-\d{2}$/.test(k); }

function hasAny(obj, keys){
  if (!obj || typeof obj !== 'object') return false;
  return keys.some(k => Object.prototype.hasOwnProperty.call(obj, k));
}
function pick(obj, keys){
  for (const k of keys) {
    if (obj && typeof obj === 'object' && typeof obj[k] === 'string' && obj[k].trim()) return obj[k];
  }
  return null;
}
function looksLikeItem(it){
  if (!it || typeof it !== 'object') return false;
  const titleLike = hasAny(it, ['title','trackTitle','song','name']);
  const gameLike  = hasAny(it, ['game','series','franchise','work','gameTitle']);
  const hasMedia  = hasAny(it, ['media','youtubeId','videoId','yt','yid','url']);
  const hasAns    = hasAny(it, ['answers','answer','canonical','canonical_answer']);
  const hasTrack  = hasAny(it, ['track','composer','composerName']);
  return (titleLike || gameLike) && (hasMedia || hasAns || hasTrack);
}

function deepFindItem(node, depth=0){
  if (node == null || depth > 4) return null;
  if (looksLikeItem(node)) return node;
  // Unwrap common single-item wrappers
  if (typeof node === 'object') {
    if ('item' in node) return deepFindItem(node.item, depth+1);
    // items: pick the first that yields a valid item
    if (Array.isArray(node.items)) {
      for (const el of node.items) {
        const found = deepFindItem(el, depth+1);
        if (found) return found;
      }
    }
    // Try common nesting keys e.g., norm/normalized/data/record/value/payload/entry
    for (const k of ['norm','normalized','data','record','value','payload','entry','content','node','attrs']) {
      if (k in node) {
        const found = deepFindItem(node[k], depth+1);
        if (found) return found;
      }
    }
    // Generic scan over object values (last resort, shallow breadth)
    for (const v of Object.values(node)) {
      const found = deepFindItem(v, depth+1);
      if (found) return found;
    }
  } else if (Array.isArray(node)) {
    for (const el of node) {
      const found = deepFindItem(el, depth+1);
      if (found) return found;
    }
  }
  return null;
}

function coerceToItemShape(raw){
  if (!raw || typeof raw !== 'object') return null;
  const title = pick(raw, ['title','trackTitle','song','name']);
  const game  = pick(raw, ['game','gameTitle','series','franchise','work']);
  const composer =
    (Array.isArray(raw?.track?.composer) && raw.track.composer.join(', ')) ||
    pick(raw, ['composer','composerName']);
  // media
  let media = null;
  if (raw.media && typeof raw.media === 'object') {
    if (typeof raw.media.provider === 'string' && typeof raw.media.id === 'string') {
      media = { provider: raw.media.provider, id: raw.media.id };
    }
  }
  if (!media) {
    const yid = pick(raw, ['youtubeId','videoId','yt','yid']);
    if (yid) media = { provider: 'youtube', id: yid };
  }
  if (!media) {
    const url = pick(raw, ['url']);
    if (url && /youtu\.be\//.test(url)) {
      const m = url.match(/youtu\.be\/([A-Za-z0-9_-]{6,})/);
      if (m) media = { provider: 'youtube', id: m[1] };
    } else if (url && /youtube\.com\/.+v=/.test(url)) {
      const m = url.match(/[?&]v=([A-Za-z0-9_-]{6,})/);
      if (m) media = { provider: 'youtube', id: m[1] };
    }
  }
  // answers
  let answers = null;
  if (raw.answers && typeof raw.answers === 'object' && typeof raw.answers.canonical === 'string') {
    answers = { canonical: raw.answers.canonical };
  } else {
    const can = pick(raw, ['canonical','canonical_answer','answer']);
    if (can) answers = { canonical: can };
  }
  const difficulty = typeof raw.difficulty === 'number' ? raw.difficulty : undefined;
  const out = { title, game, composer, media, answers };
  if (typeof difficulty !== 'undefined') out.difficulty = difficulty;
  // decide validity threshold: require title & game, and either media(provider+id) or answers.canonical
  const valid =
    typeof out.title === 'string' && out.title &&
    typeof out.game === 'string' && out.game &&
    ((out.media && typeof out.media.provider === 'string' && typeof out.media.id === 'string') ||
     (out.answers && typeof out.answers.canonical === 'string' && out.answers.canonical));
  return valid ? out : null;
}

function coerceSingleItem(candidate){
  const raw = deepFindItem(candidate, 0) || candidate;
  return coerceToItemShape(raw);
}

function latestFromDailyAuto(obj){
  if (!obj || typeof obj !== 'object' || !obj.by_date) return { date: null, item: null, _debug: { allKeys: [] } };
  const allKeys = Object.keys(obj.by_date);
  const dateKeys = allKeys.filter(isIsoDateKey);
  // Prefer an explicit latest date hint if present and valid
  const hinted = obj.latest_date || obj.latest || obj.today || obj.date;
  let date = null;
  if (typeof hinted === 'string' && isIsoDateKey(hinted) && obj.by_date[hinted]) {
    date = hinted;
  } else if (dateKeys.length) {
    date = dateKeys.sort().at(-1);
  } else {
    return { date: null, item: null, _debug: { allKeys, dateKeys } };
  }
  let candidate = obj.by_date[date];
  const item = coerceSingleItem(candidate);
  const chosenHas = candidate && typeof candidate === 'object' ? Object.keys(candidate) : [];
  const candidateItems = candidate && typeof candidate === 'object' && Array.isArray(candidate.items) ? candidate.items : undefined;
  return { date, item, _debug: { allKeys, dateKeys, chosenHas, candidateItems } };
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

  let src = null, date = null, item = null, dbg = undefined;

  if (existsSync(pToday)) {
    const u = unwrapDaily(await readJson(pToday));
    if (u.item) { src = pToday; ({date,item} = u); }
    else console.log('Warning: build/daily_today.json present but could not find an item; falling back to public/app/daily_auto.json');
  }

  if (!src) {
    src = pAuto;
    const auto = await readJson(pAuto);
    let u;
    if (forceDate && auto.by_date && auto.by_date[forceDate]) {
      let candidate = auto.by_date[forceDate];
      const it = coerceSingleItem(candidate);
      u = { date: forceDate, item: it };
    } else {
      u = latestFromDailyAuto(auto);
    }
    ({date,item} = u);
    dbg = u._debug;
  }

  if (debug) {
    const keys = item && typeof item === 'object' ? Object.keys(item) : [];
    const chosenHas = Array.isArray(dbg?.chosenHas) ? dbg.chosenHas : [];
    const itemsLen = (chosenHas.includes('items') && Array.isArray((dbg?.candidateItems))) ? (dbg.candidateItems.length) : undefined;
    console.log(`[schema-debug] src=${src} date=${date} keys=${JSON.stringify(keys)} by_date_keys=${JSON.stringify(dbg?.allKeys||[])} iso_keys=${JSON.stringify(dbg?.dateKeys||[])} chosen_has=${JSON.stringify(chosenHas)} items_len=${itemsLen}`);
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
