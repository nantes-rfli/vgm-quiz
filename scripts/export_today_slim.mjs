#!/usr/bin/env node
/**
 * Robust exporter for today's slim artifact.
 * - Input: daily_auto.json (--in path)
 * - Picks latest ISO date (or EXPORT_SLIM_FORCE_DATE), with fallback scan backward
 * - Coerces item shape to { title, game, composer?, media{provider,id}?, answers{canonical}? }
 * - Writes: build/daily_today.json ({ date, item }) and build/daily_today.md
 * - Exits non-zero if no valid item is found (strict).
 */
import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';

const FORCE = (process.env.EXPORT_SLIM_FORCE_DATE || '').trim();
const SCAN_DAYS = parseInt(process.env.EXPORT_SLIM_SCAN_DAYS || '0', 10); // 0=scan all

function isIsoDate(k){ return /^\d{4}-\d{2}-\d{2}$/.test(k); }
function hasAny(o, ks){ return !!(o && typeof o === 'object' && ks.some(k => Object.prototype.hasOwnProperty.call(o,k))); }
function pick(o, ks){ for (const k of ks){ const v=o?.[k]; if (typeof v==='string' && v.trim()) return v; } return null; }

function looksLikeItem(it){
  if (!it || typeof it !== 'object') return false;
  const idLike = hasAny(it, ['title','trackTitle','song','name']) || hasAny(it?.track||{}, ['title','name']);
  const gameLike = hasAny(it, ['game','gameTitle','series','franchise','work']);
  const hasMedia = hasAny(it, ['media','youtubeId','videoId','yid','yt','url']);
  const hasAns = hasAny(it, ['answers','answer','canonical','canonical_answer']);
  const hasTrack = hasAny(it, ['track','composer','composerName']);
  return (idLike || gameLike) && (hasMedia || hasAns || hasTrack);
}

function deepFind(node, depth=0){
  if (node == null || depth > 4) return null;
  if (looksLikeItem(node)) return node;
  if (typeof node === 'object'){
    if ('item' in node) return deepFind(node.item, depth+1);
    if (Array.isArray(node.items)) {
      for (const el of node.items){ const f=deepFind(el, depth+1); if (f) return f; }
    }
    for (const k of ['norm','normalized','data','record','value','payload','entry','content','node','attrs','flat']) {
      if (k in node) { const f=deepFind(node[k], depth+1); if (f) return f; }
    }
    for (const v of Object.values(node)){ const f=deepFind(v, depth+1); if (f) return f; }
  } else if (Array.isArray(node)){
    for (const el of node){ const f=deepFind(el, depth+1); if (f) return f; }
  }
  return null;
}

function coerce(raw){
  if (!raw || typeof raw !== 'object') return null;
  const title = pick(raw, ['title','trackTitle','song','name']) || pick(raw?.track||{}, ['title','name']);
  const game  = pick(raw, ['game','gameTitle','series','franchise','work']);
  const composer =
    (Array.isArray(raw?.track?.composer) && raw.track.composer.join(', ')) ||
    pick(raw, ['composer','composerName']);
  let media = null;
  if (raw.media && typeof raw.media === 'object' && typeof raw.media.provider === 'string' && typeof raw.media.id === 'string'){
    media = { provider: raw.media.provider, id: raw.media.id };
  }
  if (!media){
    const yid = pick(raw, ['youtubeId','videoId','yt','yid']);
    if (yid) media = { provider: 'youtube', id: yid };
  }
  if (!media){
    const url = pick(raw, ['url']);
    if (url && /youtu\.be\//.test(url)){
      const m = url.match(/youtu\.be\/([A-Za-z0-9_-]{6,})/); if (m) media = { provider: 'youtube', id: m[1] };
    } else if (url && /youtube\.com\/.+v=/.test(url)){
      const m = url.match(/[?&]v=([A-Za-z0-9_-]{6,})/); if (m) media = { provider: 'youtube', id: m[1] };
    }
  }
  let answers = null;
  if (raw.answers && typeof raw.answers === 'object' && typeof raw.answers.canonical === 'string') {
    answers = { canonical: raw.answers.canonical };
  } else {
    const can = pick(raw, ['canonical','canonical_answer','answer']);
    if (can) answers = { canonical: can };
  }
  const difficulty = typeof raw.difficulty === 'number' ? raw.difficulty : undefined;
  const item = { title, game, composer, media, answers };
  if (typeof difficulty !== 'undefined') item.difficulty = difficulty;
  const valid = item.title && item.game && ((item.media && item.media.provider && item.media.id) || (item.answers && item.answers.canonical));
  return valid ? item : null;
}

async function main(){
  const args = process.argv.slice(2);
  const inIdx = args.indexOf('--in');
  if (inIdx === -1 || !args[inIdx+1]) {
    console.log('[export_today_slim] missing --in <path-to-daily_auto.json>');
    process.exit(1);
  }
  const inPath = args[inIdx+1];
  const json = JSON.parse(await readFile(inPath, 'utf-8'));
  const by = json.by_date || {};
  const all = Object.keys(by).filter(isIsoDate).sort();
  if (all.length === 0) {
    console.error('[export_today_slim] no ISO dates in by_date; abort');
    process.exit(1);
  }
  const start = FORCE && isIsoDate(FORCE) && by[FORCE] ? FORCE : all.at(-1);
  const startIdx = all.lastIndexOf(start);
  const minIdx = (SCAN_DAYS > 0 && startIdx >= 0) ? Math.max(0, startIdx - SCAN_DAYS) : 0;

  let pickedDate = null, pickedItem = null, pickedRaw = null;
  for (let i = startIdx; i >= minIdx; i--){
    const d = all[i];
    const cand = by[d];
    const raw = deepFind(cand, 0) || cand;
    const it = coerce(raw);
    if (it){
      pickedDate = d; pickedItem = it; pickedRaw = raw; break;
    }
  }
  if (!pickedItem){
    const allowStub = (process.env.EXPORT_SLIM_STUB_ON_EMPTY || '').toLowerCase() === 'true';
    if (!allowStub){
      console.error(`[export_today_slim] no valid item found from ${start} backward; abort`);
      process.exit(1);
    }
    console.log(`::warning::[export_today_slim] no valid item found from ${start}; writing stub item (stub-on-empty enabled)`);
    pickedDate = start;
    pickedItem = {
      title: "(stub) pending fill",
      game: "(stub)",
      composer: "(stub)",
      media: { provider: "mock", id: "stub" },
      answers: { canonical: "(stub)" },
      difficulty: 0
    };
  }
  await mkdir('build', { recursive: true });
  await writeFile('build/daily_today.json', JSON.stringify({ date: pickedDate, item: pickedItem }, null, 2));
  const title = pickedItem.title || '(no title)';
  const game  = pickedItem.game  || '(no game)';
  const media = pickedItem.media?.id ? `https://youtu.be/${pickedItem.media.id}` : '';
  const md = `# ${pickedDate}\n\n- **Title**: ${title}\n- **Game**: ${game}\n${media?'- **Media**: '+media+'\n':''}`;
  await writeFile('build/daily_today.md', md);
  console.log(`[export_today_slim] wrote build/daily_today.json and build/daily_today.md for date=${pickedDate}`);
}

main().catch(e => { console.error(e); process.exit(1); });
