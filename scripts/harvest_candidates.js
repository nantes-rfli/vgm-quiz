#!/usr/bin/env node
'use strict';
/**
 * Harvest daily candidates from current dataset (skeleton).
 * - Default source: public/build/dataset.json
 * - Output: JSON Lines (one candidate per line)
 * - Non-destructive: media is optional; duplicates removed by normalized key
 */
const fs = require('fs');
const path = require('path');
const { normalizeAnswer } = require('./pipeline/normalize');
const crypto = require('crypto');
function deriveProviderId(media){
  const a = (media && typeof media==='object' && media.apple) ? media.apple : null;
  if (a && (a.embedUrl || a.url || a.previewUrl)){
    return { provider: 'apple', id: a.embedUrl || a.url || a.previewUrl };
  }
  if (media && media.provider && media.id){
    return { provider: media.provider, id: String(media.id) };
  }
  return null;
}
function ensureProvenance(c, source='dataset'){
  if (!c || typeof c!=='object') return c;
  const prev = c.provenance || (c.meta && c.meta.provenance) || {};
  const prov = { ...prev };
  if (!prov.source) prov.source = source;
  const pid = deriveProviderId(c.media || c.clip);
  if (pid){ prov.provider = prov.provider || pid.provider; prov.id = prov.id || pid.id; }
  if (!prov.collected_at) prov.collected_at = new Date().toISOString();
  if (!prov.license_hint) prov.license_hint = (c.media && c.media.apple) ? 'official' : 'unknown';
  if (!prov.hash){
    const base = `${c.norm?.title||c.title||''}|${c.norm?.game||c.game||''}|${c.norm?.composer||c.composer||''}|${prov.provider||''}|${prov.id||''}`;
    prov.hash = 'sha1:'+crypto.createHash('sha1').update(base).digest('hex');
  }
  c.provenance = prov;
  c.meta = c.meta || {}; c.meta.provenance = prov;
  return c;
}
const JSONC = {
  parse(src){
    // very small JSONC: strip // and /* */ comments
    const noBlock = src.replace(/\/\*[\s\S]*?\*\//g, '');
    const noLine = noBlock.replace(/(^|\s+)\/\/.*$/gm, '$1');
    return JSON.parse(noLine);
  }
};

function loadAllowlist(p){
  try {
    const txt = fs.readFileSync(p, 'utf-8');
    return JSON.parse(txt);
  } catch {
    return null;
  }
}

function loadAppleOverrides(p){
  try {
    const txt = fs.readFileSync(p, 'utf-8');
    return JSONC.parse(txt);
  } catch {
    return null;
  }
}

function toAppleMediaFromOverride(entry){
  if (!entry || !entry.media || !entry.media.apple) return null;
  const a = entry.media.apple;
  const apple = {};
  if (a.embedUrl) apple.embedUrl = a.embedUrl;
  if (a.previewUrl) apple.previewUrl = a.previewUrl;
  if (a.url) apple.url = a.url;
  const media = { apple };
  if (a.start_ms) media.start_ms = a.start_ms;
  return media.apple.embedUrl || media.apple.previewUrl || media.apple.url ? media : null;
}

function fillMedia(candidate, rec, opts){
  const { allowlist, appleOverrides } = opts || {};
  // 1) Apple overrides (official & safest)
  const key = `${candidate.norm.game}__${candidate.norm.title}`.toLowerCase().trim();
  if (appleOverrides && appleOverrides[key]){
    const m = toAppleMediaFromOverride(appleOverrides[key]);
    if (m) return m;
  }
  // 2) Dataset-provided Apple (if any)
  if (rec?.media?.apple && (rec.media.apple.embedUrl || rec.media.apple.previewUrl || rec.media.apple.url)){
    return { apple: {
      embedUrl: rec.media.apple.embedUrl,
      previewUrl: rec.media.apple.previewUrl,
      url: rec.media.apple.url
    }};
  }
  // 3) YouTube fallback (strict allowlist: video id exact matchのみ)
  const vid = rec?.media?.youtube?.id || rec?.youtubeId || rec?.yt || null;
  if (vid && allowlist?.youtube && (allowlist.youtube[vid] === true)){
    return { provider: 'youtube', id: vid, start_ms: rec?.media?.youtube?.start_ms || 0 };
  }
  // 4) none
  return null;
}

function readJSON(p){ return JSON.parse(fs.readFileSync(p,'utf-8')); }
function ensureDir(dir){ fs.mkdirSync(dir, { recursive:true }); }

function parseArgs(){
  const args = process.argv.slice(2);
  const outIdx = args.indexOf('--out');
  const out = outIdx>=0 ? args[outIdx+1] : 'public/app/daily_candidates.jsonl';
  const srcIdx = args.indexOf('--src');
  const src = srcIdx>=0 ? args[srcIdx+1] : 'public/build/dataset.json';
  return { out, src };
}

function resolveSrc(src){
  if (fs.existsSync(src)) return src;
  // Try common alternatives (CI/cwd variance)
  const alts = [
    path.join(process.cwd(), 'public/build/dataset.json'),
    path.join(process.cwd(), 'build/dataset.json'),
  ];
  for (const p of alts){
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function toCandidate(rec){
  const title = rec.title || rec.track || '';
  const game  = rec.game  || '';
  const composer = rec.composer || '';
  const platform = rec.platform || rec.system || null;
  const year = rec.year || null;
  const norm = {
    title: normalizeAnswer(title),
    game: normalizeAnswer(game),
    composer: normalizeAnswer(composer)
  };
  return {
    title, game, composer, platform, year,
    media: null, // fill later (youtube/appleMusic) — default-off
    source: 'dataset',
    norm
  };
}

function main(){
  const { out, src: srcArg } = parseArgs();
  const src = resolveSrc(srcArg);

  // Load allowlist / apple overrides (optional)
  const allowlistPath = path.join(process.cwd(), 'sources/allowlist.json');
  const appleOverridesPath = path.join(process.cwd(), 'resources/data/apple_overrides.jsonc');
  const allowlist = loadAllowlist(allowlistPath);
  const appleOverrides = loadAppleOverrides(appleOverridesPath);

  if(!src){
    console.error(`[harvest] source not found: ${srcArg}`);
    console.error('[harvest] Tips:');
    console.error('  - Ensure dataset exists (run: clojure -T:build publish)');
    console.error('  - Or pass a path: node scripts/harvest_candidates.js --src path/to/dataset.json');
    process.exit(1);
  }
  const dataset = readJSON(src);
  const list = Array.isArray(dataset) ? dataset : (dataset.tracks || []);
  const seen = new Set();
  const outDir = path.dirname(out);
  ensureDir(outDir);
  const ws = fs.createWriteStream(out, { encoding:'utf-8' });
  let kept = 0, total = 0;
  for(const rec of list){
    total++;
    const c = toCandidate(rec);
    if(!c.media){ c.media = fillMedia(c, rec, { allowlist, appleOverrides }); }
    const key = `${c.norm.title}|${c.norm.game}|${c.norm.composer}`;
    if(!c.norm.title || !c.norm.game || !c.norm.composer) continue;
    if(seen.has(key)) continue;
    seen.add(key);
    ws.write(JSON.stringify(ensureProvenance(c)) + '\n');
    kept++;
  }
  ws.end();
  console.log(`[harvest] input=${total}, unique=${kept}, out=${out}`);
}

if (require.main === module) main();
