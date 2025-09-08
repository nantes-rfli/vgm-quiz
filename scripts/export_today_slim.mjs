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

function stripJsonc(raw){
  return String(raw)
    .replace(/\/\*(?:.|\n|\r)*?\*\//g, '')
    .replace(/(^|\s+)\/\/.*$/gm, '');
}
async function readOverridesMaybe(...paths){
  for (const p of paths){
    try {
      const raw = await readFile(p, 'utf-8');
      return JSON.parse(stripJsonc(raw));
    } catch {}
  }
  return null;
}
function normLower(s){ return String(s||'').toLowerCase().trim().replace(/\s+/g,' '); }
function keyCandidates(item){
  const title = normLower(item?.title || item?.track?.name);
  const game  = normLower(item?.game?.name || item?.game);
  const answer= normLower(item?.answers?.canonical || item?.norm?.answer || game);
  const keys = [];
  if (game && title) keys.push(`${game}__${title}`);
  if (answer && title) keys.push(`${answer}__${title}`);
  if (answer) keys.push(answer);
  if (title) keys.push(title);
  return Array.from(new Set(keys));
}

function looksValidApple(a){
  if (!a || typeof a !== 'object') return false;
  const hasXxxxx = v => typeof v === 'string' && v.includes('xxxxx');
  const isApple = v => typeof v === 'string' && /\b(https?:)?\/\/(embed\.)?music\.apple\.com\//.test(v);
  const isPreview = v => typeof v === 'string' && /\bhttps?:\/\/.*mzstatic\.com\//.test(v) && /\.(m4a|mp3)(\?|$)/.test(v);
  // reject placeholders
  if (hasXxxxx(a.url) || hasXxxxx(a.embedUrl) || hasXxxxx(a.previewUrl)) return false;
  // require at least one valid field
  return isApple(a.embedUrl) || isApple(a.url) || isPreview(a.previewUrl);
}

function attachAppleFromOverrides(item, overrides){
  if (!overrides || typeof overrides !== 'object') return item;
  const keys = keyCandidates(item);
  for (const k of keys){
    const v = overrides[k];
    if (v && v.media && v.media.apple && looksValidApple(v.media.apple)){
      item.media = item.media || {};
      item.media.apple = v.media.apple;
      console.log('[export_today_slim] applied Apple override via key:', k);
      return item;
    }
  }
  for (const v of Object.values(overrides)){
    if (v && v.match){
      const vm = v.match;
      const wantTitle = normLower(vm.title);
      const wantGame  = normLower(vm.game);
      const wantAns   = normLower(vm.answer);
      const title = normLower(item?.title || item?.track?.name);
      const game  = normLower(item?.game?.name || item?.game);
      const ans   = normLower(item?.answers?.canonical || item?.norm?.answer || game);
      if ((wantTitle?wantTitle===title:true) &&
          (wantGame?wantGame===game:true) &&
          (wantAns?wantAns===ans:true) &&
          v.media && v.media.apple && looksValidApple(v.media.apple)){
        item.media = item.media || {};
        item.media.apple = v.media.apple;
        console.log('[export_today_slim] applied Apple override via match');
        return item;
      }
    }
  }
  return item;
}


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

async function coerce(raw){
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

  // Fallback: ensure item.meta.provenance exists (v1.10)
  if (!item.meta || !item.meta.provenance) {
    const now = new Date().toISOString();
    const provider = (item.media && item.media.provider) ? item.media.provider : 'manual';
    const pid = (item.media && item.media.id) ? String(item.media.id) : `${title||''}|${game||''}|${composer||''}`;
    const base = `${title||''}|${game||''}|${composer||''}|${provider}|${pid}`;
    const hash = 'sha1:' + require('crypto').createHash('sha1').update(base).digest('hex');
    item.meta = Object.assign({}, item.meta||{}, { provenance: {
      source: provider==='manual' ? 'manual' : 'fallback',
      provider, id: pid, collected_at: now, hash, license_hint: provider==='apple' ? 'official' : 'unknown'
    }});
  }
  const pv = (raw?.meta && raw.meta.provenance) || raw?.provenance;
  if (pv && typeof pv === 'object') {
    item.meta = Object.assign({}, item.meta || {}, { provenance: pv });
  }
  if (typeof difficulty !== 'undefined') item.difficulty = difficulty;
  // Attach Apple overrides if available
  try {
    const overrides = await readOverridesMaybe('data/apple_overrides.jsonc','resources/data/apple_overrides.jsonc');
    attachAppleFromOverrides(item, overrides);
  } catch (e) {
    console.warn('[export_today_slim] overrides read failed:', e?.message || e);
  }
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
    const it = await coerce(raw);
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
