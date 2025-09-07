#!/usr/bin/env node
/**
 * scripts/backfill_aliases_v1.mjs
 * - `public/app/daily_auto.json` の by_date から 2025-09-07 までの項目を走査し、
 *   data/aliases/{game,composer,track}.json を拡充する簡易バックフィル。
 * - 出力ログ: build/logs/backfill_YYYYMMDD.txt
 * - 既存エントリは保持し、新規キーのみ追加します（衝突時はスキップ）。
 */
import fs from 'node:fs/promises';
import fss from 'node:fs';
import path from 'node:path';

function normLower(s){ return String(s||'').toLowerCase().trim().replace(/\s+/g,' '); }
function toName(x){ return typeof x==='object' && x ? (x.name||'') : (x||''); }

async function readJson(p, fallback){ try{ return JSON.parse(await fs.readFile(p,'utf-8')); }catch{ return fallback; } }
async function writeJson(p, obj){ await fs.mkdir(path.dirname(p),{recursive:true}); await fs.writeFile(p, JSON.stringify(obj,null,2)+'\n','utf-8'); }

async function main(){
  const autoPath = 'public/app/daily_auto.json';
  const logDir = 'build/logs';
  const logPath = path.join(logDir, 'backfill_20250907.txt');
  await fs.mkdir(logDir, {recursive:true});

  const auto = await readJson(autoPath, null);
  if (!auto || !auto.by_date || typeof auto.by_date!=='object'){
    await fs.writeFile(logPath, '[backfill] no by_date found; skip\n');
    console.log('[backfill] no by_date; skip');
    return;
  }

  const aliasPaths = {
    game: 'data/aliases/game.json',
    composer: 'data/aliases/composer.json',
    track: 'data/aliases/track.json',
  };
  const aliases = {
    game: await readJson(aliasPaths.game, {}),
    composer: await readJson(aliasPaths.composer, {}),
    track: await readJson(aliasPaths.track, {}),
  };

  let added = {game:0, composer:0, track:0};
  let lines = [];

  for (const [d, item] of Object.entries(auto.by_date)){
    const title = item?.title || item?.track?.name || '';
    const game  = toName(item?.game || item?.track?.game);
    const comp  = item?.composer || item?.track?.composer || '';
    if (game){
      const k = normLower(game);
      if (!(k in aliases.game)){ aliases.game[k] = game; added.game++; lines.push(`game\t${d}\t${k}\t${game}`); }
    }
    if (comp){
      const k = normLower(comp);
      if (!(k in aliases.composer)){ aliases.composer[k] = comp; added.composer++; lines.push(`composer\t${d}\t${k}\t${comp}`); }
    }
    if (title){
      const k = normLower(title);
      if (!(k in aliases.track)){ aliases.track[k] = title; added.track++; lines.push(`track\t${d}\t${k}\t${title}`); }
    }
  }

  // write back
  await writeJson(aliasPaths.game, aliases.game);
  await writeJson(aliasPaths.composer, aliases.composer);
  await writeJson(aliasPaths.track, aliases.track);

  const summary = `[backfill] added game=${added.game} composer=${added.composer} track=${added.track}\n`;
  await fs.writeFile(logPath, summary + lines.join('\n') + (lines.length?'\n':''), 'utf-8');
  console.log(summary.trim());
}

main().catch(e=>{ console.error(e); process.exit(1); });
