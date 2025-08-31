#!/usr/bin/env node
/**
 * Generate /public/app/daily.json
 * - Reads dataset from DATASET_URL (fallback: local public/build/dataset.json if present)
 * - Picks 1 track deterministically from JST date (YYYY-MM-DD)
 * - Writes/merges into { version:1, tz:"Asia/Tokyo", map: { "<date>": {title} } }
 *
 * Env:
 *   DATASET_URL   (default: https://nantes-rfli.github.io/vgm-quiz/build/dataset.json)
 *   OUTPUT_PATH   (default: public/app/daily.json)
 *   DAILY_DATE    (override YYYY-MM-DD; default: today in Asia/Tokyo)
 *   AVOID_DAYS    (avoid repeating same title in the last N days; default: 30)
 *   TZ            (default: Asia/Tokyo) — only affects logs; date calc uses Asia/Tokyo
 */

const fs = require('fs');
const path = require('path');

const DATASET_URL = process.env.DATASET_URL || 'https://nantes-rfli.github.io/vgm-quiz/build/dataset.json';
const OUTPUT_PATH = process.env.OUTPUT_PATH || path.join('public', 'app', 'daily.json');
const AVOID_DAYS = parseInt(process.env.AVOID_DAYS || '30', 10);
// Question type for the day's share/OGP. Defaults to title→game.
// You can override via env DAILY_TYPE=game→composer (or title→composer).
const DEFAULT_TYPE = process.env.DAILY_TYPE || 'title→game';

function todayJST() {
  try {
    const fmt = new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' });
    const [{value: y}, , {value: m}, , {value: d}] = fmt.formatToParts(new Date());
    return `${y}-${m}-${d}`;
  } catch {
    // Fallback: compute JST by shifting UTC+9
    const now = new Date();
    const jst = new Date(now.getTime() + (9 * 60 * 60 * 1000));
    const pad = n => String(n).padStart(2, '0');
    return `${jst.getUTCFullYear()}-${pad(jst.getUTCMonth() + 1)}-${pad(jst.getUTCDate())}`;
  }
}

const DATE = process.env.DAILY_DATE || todayJST();

async function fetchJson(url) {
  const https = require('https');
  const { URL } = require('url');
  const u = new URL(url);
  return new Promise((resolve, reject) => {
    const req = https.get(u, { headers: { 'User-Agent': 'vgm-quiz-daily/1.0' }}, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        res.resume();
        return;
      }
      let data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
  });
}

function readLocalJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function fnv1a(str) {
  let h = 0x811c9dc5 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function pickDeterministic(tracks, seed, avoidSet) {
  if (!Array.isArray(tracks) || tracks.length === 0) {
    throw new Error('No tracks to choose from');
  }
  const base = fnv1a(seed);
  const n = tracks.length;
  // Try a few offsets to avoid recent duplicates
  for (let off = 0; off < Math.min(100, n); off++) {
    const idx = (base + off) % n;
    const t = tracks[idx];
    const title = (t && t.title) ? String(t.title) : null;
    if (!title) continue;
    if (!avoidSet.has(title)) return t;
  }
  // Fallback: just take base index
  return tracks[base % n];
}

function toDate(s) {
  // Parse YYYY-MM-DD (no timezone)
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const [_, y, mo, d] = m;
  const dt = new Date(Number(y), Number(mo) - 1, Number(d));
  return isNaN(dt) ? null : dt;
}

function daysBetween(a, b) {
  const da = toDate(a);
  const db = toDate(b);
  if (!da || !db) return Infinity;
  const ms = Math.abs(da - db);
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

(async function main() {
  // 1) Load dataset (remote-first, fallback local file if present)
  let dataset = null;
  try {
    dataset = await fetchJson(DATASET_URL);
    console.log(`[daily] loaded dataset from ${DATASET_URL}`);
  } catch (e) {
    console.warn(`[daily] failed to fetch dataset: ${e.message}. Trying local public/build/dataset.json`);
    dataset = readLocalJson(path.join('public', 'build', 'dataset.json'));
    if (!dataset) {
      console.error('[daily] no dataset available; abort');
      process.exit(1);
    }
  }
  const tracks = Array.isArray(dataset?.tracks) ? dataset.tracks : (Array.isArray(dataset) ? dataset : []);
  if (!tracks.length) {
    console.error('[daily] dataset has no tracks; abort');
    process.exit(1);
  }

  // 2) Load existing daily.json (if any)
  let daily = readLocalJson(OUTPUT_PATH);
  if (!daily || typeof daily !== 'object') {
    daily = { version: 1, tz: 'Asia/Tokyo', map: {} };
  } else {
    daily.version = 1;
    daily.tz = 'Asia/Tokyo';
    daily.map = daily.map || {};
  }

  // 3) Build avoid set from recent N days
  const avoid = new Set();
  const entries = Object.entries(daily.map);
  for (const [d, v] of entries) {
    if (daysBetween(d, DATE) <= AVOID_DAYS) {
      const title = typeof v === 'string' ? v : (v && v.title);
      if (title) avoid.add(String(title));
    }
  }

  // 4) Pick a track deterministically from DATE; avoid recent repeats
  const picked = pickDeterministic(tracks, DATE, avoid);
  const title = picked?.title ? String(picked.title) : null;
  if (!title) {
    console.error('[daily] picked track has no title; abort');
    process.exit(1);
  }

  // 5) Update map and write file
  // Keep backward compatibility: include title and new type field.
  daily.map[DATE] = { title, type: DEFAULT_TYPE };

  // Ensure directory exists
  const dir = path.dirname(OUTPUT_PATH);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(daily, null, 2) + '\n', 'utf8');
  console.log(`[daily] wrote ${OUTPUT_PATH} for ${DATE}: ${title}`);
})().catch(err => {
  console.error('[daily] fatal error:', err);
  process.exit(1);
});

