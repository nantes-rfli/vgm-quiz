#!/usr/bin/env node
/**
 * oneq preview: pick 1 track (Apple>YT), generate daily JSON as artifact
 * - Non-destructive: writes to out/daily-YYYY-MM-DD.json (no commit)
 */
import path from 'node:path';
import { loadDataset, loadMediaMap, listTracks, resolveMedia, writeJSON, sha256, todayYMD, loadLock } from './oneq_lib.mjs';

const { ds, origin } = await loadDataset();
if (!ds) {
  console.log('[oneq] dataset not found');
  process.exit(0);
}
const mediaMap = loadMediaMap();
const tracks = listTracks(ds);
const lock = loadLock(); // read-only here (preview)

function isUsed(t){ const tid = t['track/id'] || ''; return Array.isArray(lock.used) && lock.used.includes(tid); }

const enriched = tracks.map(t => ({ t, m: resolveMedia(t, mediaMap) }))
  .filter(x => !!x.m && (x.m.provider === 'apple' || x.m.provider === 'youtube'))
  .filter(x => !isUsed(x.t));

// Apple first
enriched.sort((a,b) => {
  const pa = a.m.provider === 'apple' ? 0 : 1;
  const pb = b.m.provider === 'apple' ? 0 : 1;
  if (pa !== pb) return pa - pb;
  // deterministic tie-breaker
  return String(a.t['track/id']).localeCompare(String(b.t['track/id']));
});

if (!enriched.length) {
  console.log('[oneq] no candidate (all used or no media). dataset:', origin);
  process.exit(0);
}

const pick = enriched[0];
const date = todayYMD();
const prov = pick.m.provider;
const mid = pick.m.id;
const track = pick.t;

const base = {
  date,
  question: {
    type: "guess-track",
    locale: "ja",
    title: track.title || null,
    game: track.game || null,
    composer: track.composer || null,
    "track/id": track['track/id']
  },
  media: {
    provider: prov,
    id: mid
  },
  provenance: {
    source: "docs/data/media_map.json",
    provider: prov,
    id: mid,
    collected_at: new Date().toISOString(),
    hash: sha256([track['track/id'], prov, mid].join('::')),
    license_hint: "embed-only; see provider terms"
  }
};

const outPath = path.resolve('out', `daily-${date}.json`);
writeJSON(outPath, base);
console.log('[oneq] preview written:', outPath);

