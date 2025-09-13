// Shared helpers for v1.13 oneq
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';

export function readJSON(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } }
export function writeJSON(p, obj) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(obj, null, 2)); }

export async function fetchJSON(url, timeoutMs = 8000) {
  try {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'accept': 'application/json' } });
    clearTimeout(to);
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

export async function loadDataset() {
  const local = path.resolve('public/build/dataset.json');
  let ds = readJSON(local);
  let origin = `local:${local}`;
  if (!ds) {
    const repo = process.env.GITHUB_REPOSITORY || 'nantes-rfli/vgm-quiz';
    const [owner, name] = repo.split('/');
    const base = process.env.ONEQ_DATASET_BASE || `https://${owner}.github.io/${name}`;
    const candidates = [
      process.env.ONEQ_DATASET_URL,
      `${base}/build/dataset.json`,
      `${base}/app/build/dataset.json`
    ].filter(Boolean);
    for (const url of candidates) {
      ds = await fetchJSON(url);
      if (ds) { origin = `remote:${url}`; break; }
      await sleep(200);
    }
  }
  return { ds, origin };
}

export function loadMediaMap() {
  const mapPath = path.resolve('docs/data/media_map.json');
  if (!fs.existsSync(mapPath)) return { byId: new Map(), path: null };
  try {
    const rows = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
    const byId = new Map();
    for (const r of Array.isArray(rows) ? rows : []) {
      const k = String(r.track_id || '').trim();
      const prov = String(r.provider || '').toLowerCase().trim();
      const mid = String(r.id || '').trim();
      if (!k || !prov || !mid) continue;
      if (mid === 'FILL_ME' || /^FILL_ME/i.test(mid)) continue;
      byId.set(k, { provider: prov, id: mid });
    }
    return { byId, path: mapPath };
  } catch { return { byId: new Map(), path: mapPath }; }
}

export function listTracks(ds) {
  if (ds && Array.isArray(ds.tracks)) return ds.tracks;
  return Array.isArray(ds) ? ds : [];
}

export function resolveMedia(track, mediaMap) {
  const tid = (track['track/id'] || track.track_id || '').toString();
  if (tid && mediaMap?.byId?.has(tid)) return mediaMap.byId.get(tid);
  if (track.media && track.media.provider && track.media.id) {
    return { provider: String(track.media.provider).toLowerCase(), id: String(track.media.id) };
  }
  return null;
}

export function sha256(s) { return crypto.createHash('sha256').update(s).digest('hex'); }

export function todayYMD() {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function loadLock() {
  const p = path.resolve('docs/data/daily_lock.json');
  if (!fs.existsSync(p)) return { used: [], path: p };
  try { return { ...(JSON.parse(fs.readFileSync(p, 'utf8'))||{}), path: p }; }
  catch { return { used: [], path: p }; }
}

export function addToLock(lock, trackId) {
  if (!Array.isArray(lock.used)) lock.used = [];
  if (!lock.used.includes(trackId)) lock.used.push(trackId);
}

