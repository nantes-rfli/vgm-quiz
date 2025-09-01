#!/usr/bin/env node
'use strict';
/**
 * Enrich candidates JSONL with better `media.start` guesses.
 * - Prefer dataset-provided starts (public/build/dataset.json)
 * - Parse common YouTube params (?t=, ?start=, #t=1m23s)
 * - Fallback heuristic on title keywords; default 45s
 * - (opt-in) If --allow-heuristic-media is set, create `media` when absent using heuristic start
 *
 * Usage:
 *   node scripts/enrich_media_start.js --in public/app/daily_candidates_scored.jsonl --out public/app/daily_candidates_scored_enriched.jsonl [--allow-heuristic-media]
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { normalizeAnswer } = require('./pipeline/normalize');

function secFromTimecode(tc){
  // 1h2m3s / 2m10s / 90s / 75
  const m = String(tc).match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i);
  if (m && (m[1]||m[2]||m[3])){
    const h = parseInt(m[1]||'0',10);
    const mn = parseInt(m[2]||'0',10);
    const s = parseInt(m[3]||'0',10);
    return h*3600 + mn*60 + s;
  }
  const n = Number(tc);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : null;
}

function extractYouTubeId(url){
  // supports: youtu.be/ID, youtube.com/watch?v=ID, youtube-nocookie.com/embed/ID
  try{
    const u = new URL(url);
    if (/youtu\.be$/.test(u.hostname)) return u.pathname.slice(1);
    if (/youtube(?:-nocookie)?\.com$/.test(u.hostname)){
      if (u.pathname.startsWith('/watch')) return u.searchParams.get('v');
      const m = u.pathname.match(/\/embed\/([\w-]{5,})/);
      if (m) return m[1];
    }
  }catch{}
  // fallback: raw id-ish
  const m = String(url).match(/([\w-]{11})/);
  return m ? m[1] : null;
}

function extractStartFromUrl(url){
  try{
    const u = new URL(url);
    const t = u.searchParams.get('t') || u.searchParams.get('start');
    const s1 = secFromTimecode(t);
    if (s1!=null) return s1;
    if (u.hash && u.hash.includes('t=')){
      const v = u.hash.split('t=')[1];
      const s2 = secFromTimecode(v);
      if (s2!=null) return s2;
    }
  }catch{}
  // also accept fragments like #1m23s
  const m = String(url).match(/#(\d+h)?(\d+m)?(\d+s)/i);
  if (m){ return secFromTimecode(m[0].slice(1)); }
  return null;
}

function readJSON(p){ return JSON.parse(fs.readFileSync(p,'utf-8')); }
async function readJSONL(p){
  const rs = fs.createReadStream(p, 'utf-8');
  const rl = readline.createInterface({ input: rs, crlfDelay: Infinity });
  const rows = [];
  for await (const line of rl){
    const s = line.trim(); if (!s) continue;
    try { rows.push(JSON.parse(s)); } catch {}
  }
  return rows;
}
function ensureDir(dir){ fs.mkdirSync(dir, { recursive:true }); }

function parseArgs(){
  const args = process.argv.slice(2);
  const i = args.indexOf('--in');  const input = i>=0 ? args[i+1] : 'public/app/daily_candidates_scored.jsonl';
  const o = args.indexOf('--out'); const output = o>=0 ? args[o+1] : 'public/app/daily_candidates_scored_enriched.jsonl';
  const d = args.indexOf('--dataset'); const datasetPath = d>=0 ? args[d+1] : 'public/build/dataset.json';
  const ahm = args.indexOf('--allow-heuristic-media'); const allowHeuristicMedia = ahm>=0;
  return { input, output, datasetPath, allowHeuristicMedia };
}

function buildMediaIndex(dataset){
  const index = new Map(); // key -> {kind,id,start?}
  const list = Array.isArray(dataset) ? dataset : (dataset.tracks || []);
  for(const rec of list){
    const title = rec.title || rec.track || '';
    const game  = rec.game  || '';
    const composer = rec.composer || '';
    const key = `${normalizeAnswer(title)}|${normalizeAnswer(game)}|${normalizeAnswer(composer)}`;
    let media = null;
    // known fields
    const yt = rec.youtube || rec.youtubeId || rec.youtube_id || rec.yt || rec.video || rec.url;
    if (yt){
      const id = extractYouTubeId(yt);
      const start = extractStartFromUrl(yt) ?? rec.start ?? rec.t ?? rec.startSeconds ?? null;
      if (id){
        media = { kind:'youtube', id, start: start!=null ? Number(start) : undefined };
      }
    }
    // apple music preview start (ms) → seconds if no youtube
    if (!media){
      const ms = rec.previewStartMs || rec.applePreviewStartMs || rec.apple_preview_start_ms;
      if (ms!=null){
        media = { kind:'apple', previewStart: Math.floor(Number(ms)/1000) };
      }
    }
    if (media){
      index.set(key, media);
    }
  }
  return index;
}

function heuristicStart(c){
  const text = [c.title, c.game].filter(Boolean).join(' ').toLowerCase();
  if (/\bintro\b|prologue/.test(text)) return 5;
  if (/\bboss\b/.test(text)) return 15;
  if (/\bbattle\b/.test(text)) return 25;
  if (/main\s*theme|title\s*theme/.test(text)) return 30;
  return 45; // default
}

async function main(){
  const { input, output, datasetPath, allowHeuristicMedia } = parseArgs();
  if (!fs.existsSync(input)) { console.error(`[enrich] not found: ${input}`); process.exit(1); }
  let mediaIndex = new Map();
  if (fs.existsSync(datasetPath)){
    try {
      const dataset = readJSON(datasetPath);
      mediaIndex = buildMediaIndex(dataset);
    } catch (e) {
      console.warn('[enrich] dataset read failed; continue with heuristic only:', e.message);
    }
  } else {
    console.warn('[enrich] dataset not found; continue with heuristic only');
  }
  const rows = await readJSONL(input);
  const outDir = path.dirname(output); ensureDir(outDir);
  const ws = fs.createWriteStream(output, 'utf-8');
  let touched = 0, total=0, createdHeuristic=0;
  for(const c of rows){
    total++;
    const key = `${c.norm.title}|${c.norm.game}|${c.norm.composer}`;
    const idx = mediaIndex.get(key);
    if (!c.media && idx){
      c.media = { ...idx };
      if (typeof c.media.start !== 'number') c.media.start = heuristicStart(c);
      touched++;
    } else if (c.media){
      if (typeof c.media.start !== 'number'){
        if (idx && typeof idx.start === 'number') {
          c.media.start = Number(idx.start);
          touched++;
        } else {
          const guess = heuristicStart(c);
          c.media.start = guess;
          touched++;
        }
      }
    } else {
      // no media at all
      if (allowHeuristicMedia){
        c.media = { kind: 'heuristic', start: heuristicStart(c) };
        touched++; createdHeuristic++;
      }
    }
    ws.write(JSON.stringify(c) + '\n');
  }
  ws.end();
  console.log(`[enrich] in=${total}, updated=${touched}, createdHeuristic=${createdHeuristic}, out=${output}`);
}

if (require.main === module) main();
