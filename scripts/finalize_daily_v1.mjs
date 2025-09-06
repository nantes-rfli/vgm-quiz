#!/usr/bin/env node
/**
 * finalize_daily_v1.mjs
 * Normalize `public/app/daily_auto.json` to the **flat by_date** shape expected by
 * scripts/validate_authoring.js and ensure minimum required fields exist.
 *
 * Input:
 *   --in   path to daily_auto.json (default: public/app/daily_auto.json)
 *   --date YYYY-MM-DD (JST). If omitted, the latest date in by_date is targeted,
 *                      but all dates are normalized.
 * Output: overwrite the input JSON in place.
 */

import fs from 'node:fs/promises';
import fss from 'node:fs';
import { normalizeAll } from './normalize_core.mjs';

function parseArgs(argv){
  const a = { in: 'public/app/daily_auto.json', date: null };
  for (let i=2;i<argv.length;i++){
    const t = argv[i];
    if (t==='--in') a.in = argv[++i];
    else if (t==='--date') a.date = argv[++i];
  }
  return a;
}

function normText(s){
  // Unify via normalize_core.mjs (dashes/CJK spaces/Roman numerals/長音 around N)
  // Preserve existing lowercasing + whitespace collapse for stable keys
  const base = String(s || '').toLowerCase().trim().replace(/\s+/g, ' ');
  return normalizeAll(base);
}

function toEntries(by_date){
  // Accept: array [{date, items:[...]}] | object {"YYYY-MM-DD": {items:[...]}} | object {"YYYY-MM-DD": flat}
  if (Array.isArray(by_date)){
    return by_date.map(d=>{
      if (d && typeof d==='object' && 'date' in d){
        const flat = Array.isArray(d.items) ? d.items[0] : d;
        return { date: d.date, value: flat };
      }
      return null;
    }).filter(Boolean);
  }
  if (by_date && typeof by_date==='object'){
    return Object.entries(by_date).map(([date,v])=>{
      const flat = Array.isArray(v?.items) ? v.items[0] : v;
      return { date, value: flat };
    });
  }
  return [];
}

function ensureFlatFields(v){
  if (!v || typeof v!=='object') v = {};
  const title = v.title || v.track?.name || v.game?.name || v.norm?.title || v.norm?.answer || v.answers?.canonical || 'Unknown';
  const gameStr = typeof v.game==='string' ? v.game : (v.game?.name || v.game?.series || v.norm?.game || v.norm?.series || v.answers?.canonical || title || 'Unknown');
  const composer = v.composer || v.track?.composer || v.norm?.composer || 'Unknown';
  const media = v.media || v.clip || null;
  const answersCanon = v.answers?.canonical || (typeof v.answers==='string' ? v.answers : gameStr);
  const out = {
    title,
    game: gameStr,
    composer,
    media: media ? { provider: media.provider, id: media.id, start: media.start, duration: media.duration } : null,
    answers: answersCanon ? { canonical: answersCanon } : undefined,
    choices: v.choices && Array.isArray(v.choices) ? v.choices : v.choices, // keep as-is if already set (array or object)
    difficulty: (typeof v.difficulty === 'number' && isFinite(v.difficulty)) ? v.difficulty : v.difficulty
  };
  // Norm pack
  out.norm = {
    title: normText(title),
    game: normText(gameStr),
    series: normText(v.game?.series || gameStr),
    composer: normText(composer),
    answer: normText(answersCanon)
  };
  return out;
}

async function run(){
  const args = parseArgs(process.argv);
  const raw = await fs.readFile(args.in,'utf-8');
  const json = JSON.parse(raw);
  const entries = toEntries(json.by_date);
  if (!entries.length){
    console.warn('[finalize_daily_v1] by_date empty; nothing to do.');
    return;
  }
  // determine target date (latest if not specified)
  const dates = entries.map(e=>e.date).sort();
  const target = args.date || dates[dates.length-1];

  // Normalize all dates to flat shape
  const flat = {};
  for (const {date, value} of entries){
    flat[date] = ensureFlatFields(value||{});
  }
  json.by_date = flat;

  await fs.writeFile(args.in, JSON.stringify(json, null, 2), 'utf-8');
  console.log(`[finalize_daily_v1] normalized by_date for ${entries.length} dates; target=${target}`);
}

run().catch(e=>{
  console.error(e);
  process.exit(1);
});
