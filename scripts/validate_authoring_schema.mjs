#!/usr/bin/env node
/**
 * v1.8 schema check (soft by default)
 * - Validates shape of ONE daily item.
 * - Sources (priority):
 *   1) build/daily_today.json (accepts {date,item}, {date,...item}, {date,flat:{...}}, {date,items:[...]}, or plain item)
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
const fallbackScanDays = parseInt(process.env.SCHEMA_CHECK_FALLBACK_SCAN_DAYS || '0', 10); // 0=scan all
const allowEmpty = (process.env.SCHEMA_CHECK_ALLOW_EMPTY || '').toLowerCase() === 'true';

function annotate(msg, level='error'){
  const tag = level === 'warning' ? '::warning::' : '::error::';
  console.log(`${tag}${msg}`);
}

async function readJson(p){
  return JSON.parse(await readFile(p, 'utf-8'));
}

function unwrapDaily(obj){
  // Accept multiple build shapes:
  // - { date, item }
  // - { date, ...item }
  // - { date, flat: {...} }
  // - { date, items: [...] }  (pick the first valid)
  // - plain item
  // - fallback: deep search inside the object
  if (!obj || typeof obj !== 'object') return { date: null, item: null };
  const date = obj.date ?? null;
  // 1) direct item
  if ('item' in obj) {
    const it = coerceSingleItem(obj.item) || obj.item;
    return { date, item: it };
  }
  // 2) flat
  if (obj.flat && typeof obj.flat === 'object') {
    const it = coerceSingleItem(obj.flat) || obj.flat;
    return { date, item: it };
  }
  // 3) items array
  if (Array.isArray(obj.items)) {
    for (const el of obj.items) {
      const it = coerceSingleItem(el);
      if (it) return { date, item: it };
    }
  }
  // 4) {date,...item} style (top-level looks like item)
  const keys = Object.keys(obj);
  const looksLikeItem = ['title','game','composer','media','answers','track'].some(k => keys.includes(k));
  if (looksLikeItem) {
    const { date: _d = null, ...rest } = obj;
    return { date: date ?? _d, item: rest };
  }
  // 5) last resort: deep search for an item-like object
  const deep = coerceSingleItem(obj);
  if (deep) return { date, item: deep };
  return { date, item: null };
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
  const dateKeys = allKeys.filter(isIsoDateKey).sort();
  const hinted = obj.latest_date || obj.latest || obj.today || obj.date;
  let startDate = null;
  if (typeof hinted === 'string' && isIsoDateKey(hinted) && obj.by_date[hinted]) {
    startDate = hinted;
  } else if (dateKeys.length) {
    startDate = dateKeys.at(-1);
  } else {
    return { date: null, item: null, _debug: { allKeys, dateKeys } };
  }
  // scan backward from startDate to find the first non-empty item
  const startIdx = dateKeys.lastIndexOf(startDate);
  const minIdx = (fallbackScanDays > 0 && startIdx >= 0) ? Math.max(0, startIdx - fallbackScanDays) : 0;
  for (let i = startIdx; i >= minIdx; i--) {
    const date = dateKeys[i];
    const candidate = obj.by_date[date];
    const item = coerceSingleItem(candidate);
    const chosenHas = candidate && typeof candidate === 'object' ? Object.keys(candidate) : [];
    const candidateItems = candidate && typeof candidate === 'object' && Array.isArray(candidate.items) ? candidate.items : undefined;
    if (item) {
      const _debug = { allKeys, dateKeys, chosenHas, candidateItems, picked: date, startDate };
      if (date !== startDate) {
        console.log(`::warning::schema: latest date ${startDate} had no valid item; fell back to ${date}`);
      }
      return { date, item, _debug };
    }
  }
  // no item found in the scan range
  const candidate = obj.by_date[startDate];
  const chosenHas = candidate && typeof candidate === 'object' ? Object.keys(candidate) : [];
  const candidateItems = candidate && typeof candidate === 'object' && Array.isArray(candidate.items) ? candidate.items : undefined;
  return { date: startDate, item: null, _debug: { allKeys, dateKeys, chosenHas, candidateItems, picked: null, startDate } };
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
    const raw = await readJson(pToday);
    const u = unwrapDaily(raw);
    if (u.item) { src = pToday; ({date,item} = u); }
    else {
      const top = raw && typeof raw === 'object' ? Object.keys(raw) : [];
      console.log('Warning: build/daily_today.json present but could not find an item; falling back to public/app/daily_auto.json');
      if (debug) console.log(`[schema-debug] build_today_top_keys=${JSON.stringify(top)}`);
    }
  }

  if (!src) {
    src = pAuto;
    const auto = await readJson(pAuto);
    let u;
    if (forceDate && auto.by_date && auto.by_date[forceDate]) {
      let candidate = auto.by_date[forceDate];
      const it = coerceSingleItem(candidate);
      u = { date: forceDate, item: it, _debug: { allKeys: Object.keys(auto.by_date), dateKeys: Object.keys(auto.by_date).filter(isIsoDateKey), chosenHas: candidate && typeof candidate === 'object' ? Object.keys(candidate) : [], candidateItems: Array.isArray(candidate?.items) ? candidate.items : undefined, picked: forceDate, startDate: forceDate } };
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
    const picked = dbg?.picked || null;
    const startDate = dbg?.startDate || null;
    console.log(`[schema-debug] src=${src} date=${date} keys=${JSON.stringify(keys)} by_date_keys=${JSON.stringify(dbg?.allKeys||[])} iso_keys=${JSON.stringify(dbg?.dateKeys||[])} chosen_has=${JSON.stringify(chosenHas)} items_len=${itemsLen} picked=${picked} start=${startDate}`);
  }

  // Special-case: no item at all
  if (!item) {
    const msg = `schema: no item for date=${date||'unknown'}`;
    if (allowEmpty) {
      annotate(msg + ' (allow-empty)', 'warning');
      console.log(`schema: OK file=${src} date=${date||'unknown'} (empty allowed)`);
      process.exit(0);
    } else {
      annotate('schema: no item in source', 'error');
      console.log(`schema: violations=1 file=${src}`);
      process.exit(strict ? 1 : 0);
    }
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
