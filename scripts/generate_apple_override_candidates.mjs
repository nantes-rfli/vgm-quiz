#!/usr/bin/env node
/**
 * generate_apple_override_candidates.mjs
 *
 * 目的:
 *  既存の候補JSONLから Apple Music のオーバーライドキーのたたき台を自動生成する。
 *  出力は JSONC（コメント可）。各エントリは media.apple の空テンプレを含む。
 *
 * 入力（優先順）:
 *  - public/app/daily_candidates_scored_enriched.jsonl
 *  - public/app/daily_candidates_scored.jsonl
 *  - public/app/daily_candidates.jsonl
 *
 * 使い方:
 *  node scripts/generate_apple_override_candidates.mjs [--in <path.jsonl>] [--out <path.jsonc>]
 *  例:
 *    node scripts/generate_apple_override_candidates.mjs --out build/apple_override_candidates.jsonc
 */
import fs from 'node:fs/promises';
import fss from 'node:fs';
import path from 'node:path';

function normLower(s){ return String(s||'').toLowerCase().trim().replace(/\s+/g,' '); }
function keyFrom(item){
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

function parseArgs(argv){
  const out = { ins: [], out: 'build/apple_override_candidates.jsonc' };
  for (let i=0;i<argv.length;i++){
    const a = argv[i];
    if (a === '--in' && argv[i+1]) { out.ins.push(argv[++i]); continue; }
    if (a === '--out' && argv[i+1]) { out.out = argv[++i]; continue; }
    }
  return out;
}

async function pickInputs(ins){
  if (ins && ins.length) return ins;
  const defaults = [
    'public/app/daily_candidates_scored_enriched.jsonl',
    'public/app/daily_candidates_scored.jsonl',
    'public/app/daily_candidates.jsonl'
  ];
  const avail = [];
  for (const p of defaults){
    try { await fs.access(p); avail.push(p); } catch {}
  }
  return avail.length ? [avail[0]] : [];
}

async function readJsonl(path){
  const raw = await fs.readFile(path, 'utf-8');
  const lines = raw.split(/\r?\n/).filter(Boolean);
  return lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}

async function main(){
  const opts = parseArgs(process.argv.slice(2));
  const inputs = await pickInputs(opts.ins);
  if (!inputs.length){
    console.error('[gen apple candidates] 入力が見つかりませんでした (--in で指定可)');
    process.exit(2);
  }
  const arr = await readJsonl(inputs[0]);
  const out = {};
  for (const it of arr){
    const keys = keyFrom(it);
    if (!keys.length) continue;
    const key = keys[0];
    if (out[key]) continue; // de-dup
    out[key] = {
      // 任意: 厳密一致させたい場合は match を使う
      // "match": {
      //   "title": normLower(it?.title || it?.track?.name),
      //   "game":  normLower(it?.game?.name || it?.game),
      //   "answer": normLower(it?.answers?.canonical || it?.norm?.answer || (it?.game?.name || it?.game))
      // },
      "media": { "apple": {
        "url": "https://music.apple.com/jp/album/xxxxx",
        "embedUrl": "https://embed.music.apple.com/jp/album/xxxxx",
        "previewUrl": "https://is1-ssl.mzstatic.com/.../preview.m4a"
      }}
    };
  }
  await fs.mkdir(path.dirname(opts.out), { recursive: true });
  const jsonc = JSON.stringify(out, null, 2);
  const header = '// Auto-generated template; fill Apple URLs as needed.\n';
  await fs.writeFile(opts.out, header + jsonc + '\n', 'utf-8');
  console.error(`[gen apple candidates] wrote ${Object.keys(out).length} entries → ${opts.out}`);
}

main().catch(e=>{ console.error(e); process.exit(1); });
