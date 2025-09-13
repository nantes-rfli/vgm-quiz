#!/usr/bin/env node
/**
 * oneq publish: pick 1 track and write to public/daily/YYYY-MM-DD.json
 * - Updates docs/data/daily_lock.json (append used track/id)
 * - Does NOT commit here; workflow will open a PR with the changes.
 */
import path from 'node:path';
import { loadDataset, loadMediaMap, listTracks, resolveMedia, writeJSON, sha256, todayYMD, loadLock, addToLock, readJSON } from './oneq_lib.mjs';

const { ds, origin } = await loadDataset();
if (!ds) {
  console.log('[oneq] dataset not found (origin=%s)', origin);
  process.exit(0);
}
const mediaMap = loadMediaMap();
const tracks = listTracks(ds);
const lock = loadLock();

function isUsed(t){ const tid = t['track/id'] || ''; return Array.isArray(lock.used) && lock.used.includes(tid); }

const enriched = tracks.map(t => ({ t, m: resolveMedia(t, mediaMap) }))
  .filter(x => !!x.m && (x.m.provider === 'apple' || x.m.provider === 'youtube'))
  .filter(x => !isUsed(x.t));

// Apple first, deterministic
enriched.sort((a,b) => {
  const pa = a.m.provider === 'apple' ? 0 : 1;
  const pb = b.m.provider === 'apple' ? 0 : 1;
  if (pa !== pb) return pa - pb;
  return String(a.t['track/id']).localeCompare(String(b.t['track/id']));
});

if (!enriched.length) {
  console.log('[oneq] no candidate to publish (all used or no media). dataset:', origin);
  process.exit(0);
}

const pick = enriched[0];
const date = todayYMD();
const prov = pick.m.provider;
const mid = pick.m.id;
const track = pick.t;

const obj = {
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

const outPath = path.resolve('public/daily', `${date}.json`);
writeJSON(outPath, obj);

// update lock
addToLock(lock, track['track/id']);
writeJSON(lock.path, { used: lock.used });

console.log('[oneq] publish written:', outPath);

// ---- Also append to legacy map: public/app/daily_auto.json (so the app can play it today)
try {
  const mapPath = path.resolve('public', 'app', 'daily_auto.json');
  let j = readJSON(mapPath) || {};
  if (!j.by_date) j.by_date = {};
  j.by_date[date] = {
    provider: prov,
    id: mid,
    title: track.title || '',
    game: track.game || '',
    composer: track.composer || '',
    // 現行UIが期待する簡易回答セット（title/game/composer それぞれの正解候補）
    answers: {
      title: [track.title || ''].filter(Boolean),
      game: [track.game || ''].filter(Boolean),
      composer: [track.composer || ''].filter(Boolean)
    }
  };
  writeJSON(mapPath, j);
  console.log('[oneq] daily_auto.json updated:', mapPath);
} catch (e) {
  console.warn('[oneq] WARN: failed to update daily_auto.json', e && e.message);
}

