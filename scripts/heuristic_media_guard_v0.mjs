#!/usr/bin/env node
/**
 * heuristic_media_guard_v0.mjs
 * - 候補JSONLを受け取り、明らかに不正/非公式/壊れの可能性が高い行を除外する。
 * - v0の簡易ヒューリスティック（外部ネットワークは使わない）。
 *
 * 仕様
 * - 入力: --in <jsonl>（既定: public/app/daily_candidates.jsonl）
 * - 出力: --out <jsonl>（既定: public/app/daily_candidates_guarded.jsonl）
 * - 基本基準:
 *   - provider は apple / youtube のみ許可
 *   - id 形式検査: apple は数値, youtube は長さ11かつ [A-Za-z0-9_-]
 *   - title / answers.canonical の空は除外
 * - 統計は Step Summary に出力
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

function parseArgs(argv){
  const args = { in: 'public/app/daily_candidates.jsonl', out: 'public/app/daily_candidates_guarded.jsonl' };
  for (let i=0;i<argv.length;i++){
    const a = argv[i];
    if (a === '--in' && i+1 < argv.length) args.in = argv[++i];
    else if (a === '--out' && i+1 < argv.length) args.out = argv[++i];
  }
  return args;
}
function* readJSONL(p){
  const text = fs.readFileSync(p,'utf-8');
  for (const line of text.split(/\r?\n/)){
    const s = line.trim(); if (!s) continue;
    try{ yield JSON.parse(s); }catch{}
  }
}
function isYoutubeId(id){
  return typeof id === 'string' && id.length === 11 && /^[A-Za-z0-9_-]+$/.test(id);
}
function isAppleId(id){
  return typeof id === 'string' && /^[0-9]+$/.test(id);
}
function guard(entry){
  const prov = (entry?.clip?.provider || entry?.provider || '').toLowerCase();
  const id = entry?.clip?.id || entry?.id || '';
  if (!(prov === 'youtube' || prov === 'apple')) return { keep:false, reason:'provider-unsupported' };
  if (prov === 'youtube' && !isYoutubeId(id)) return { keep:false, reason:'youtube-id-format' };
  if (prov === 'apple' && !isAppleId(id)) return { keep:false, reason:'apple-id-format' };
  const title = entry?.title || entry?.track?.name || '';
  const ans = entry?.answers?.canonical || '';
  if (!String(title).trim()) return { keep:false, reason:'missing-title' };
  if (!String(ans).trim()) return { keep:false, reason:'missing-answer' };
  return { keep:true, reason:'' };
}
async function main(){
  const args = parseArgs(process.argv.slice(2));
  const kept = [];
  const stats = { in:0, kept:0, drop:0 };
  const reasons = {};
  for (const c of readJSONL(args.in)){
    stats.in++;
    const g = guard(c);
    if (g.keep){ kept.push(c); stats.kept++; }
    else { stats.drop++; reasons[g.reason] = (reasons[g.reason]||0)+1; }
  }
  await fsp.mkdir(path.dirname(args.out), { recursive:true });
  await fsp.writeFile(args.out, kept.map(o=>JSON.stringify(o)).join('\n')+'\n', 'utf-8');
  const lines = [
    '### heuristic-media-guard v0',
    `- in: **${stats.in}**`,
    `- kept: **${stats.kept}**`,
    `- drop: ${stats.drop}`,
    `- reasons: ${Object.entries(reasons).map(([k,v])=>`${k}:${v}`).join(', ') || '(none)'}`,
  ];
  if (process.env.GITHUB_STEP_SUMMARY){
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join('\n')+'\n');
  } else {
    console.log(lines.join('\n'));
  }
}
main().catch(e=>{ console.error(e); process.exit(1); });



