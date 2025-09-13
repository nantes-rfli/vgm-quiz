#!/usr/bin/env node
/**
 * Seed file for docs/data/media_map.todo.json from dataset (local or Pages)
 * - Non-destructive: writes a TODO file (does not touch media_map.json)
 * - Default provider is "apple"; adjust as needed.
 */
import fs from 'node:fs';
import path from 'node:path';

function readJSON(p){ try{ return JSON.parse(fs.readFileSync(p,'utf8')); }catch{ return null; } }

const local = path.resolve('public/build/dataset.json');
let ds = readJSON(local);
let origin = `local:${local}`;

async function fetchJSON(url){
  try{
    const ctrl = new AbortController();
    const t = setTimeout(()=>ctrl.abort(), 8000);
    const r = await fetch(url, { signal: ctrl.signal, headers: { 'accept':'application/json' } });
    clearTimeout(t);
    if(!r.ok) return null;
    return await r.json();
  }catch{ return null; }
}

if(!ds){
  const repo = process.env.GITHUB_REPOSITORY || 'nantes-rfli/vgm-quiz';
  const [owner, name] = repo.split('/');
  const base = process.env.ONEQ_DATASET_BASE || `https://${owner}.github.io/${name}`;
  const url = process.env.ONEQ_DATASET_URL || `${base}/build/dataset.json`;
  ds = await fetchJSON(url);
  origin = `remote:${url}`;
}

if(!ds || !Array.isArray(ds.tracks)){
  console.error('[seed] dataset not found or invalid');
  process.exit(1);
}

const rows = ds.tracks.map(t => ({
  "track_id": t['track/id'],
  "title": t.title,
  "game": t.game,
  "composer": t.composer,
  "provider": "apple",
  "id": "FILL_ME"
}));

const outPath = path.resolve('docs/data/media_map.todo.json');
fs.writeFileSync(outPath, JSON.stringify(rows, null, 2));
console.log('[seed] wrote', outPath, 'from', origin, 'rows=', rows.length);

