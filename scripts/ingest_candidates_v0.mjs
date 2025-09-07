#!/usr/bin/env node
/**
 * ingest_candidates_v0.mjs
 * - sources/seed_candidates.jsonl（必須）と sources/allowlist.json（任意）から
 *   public/app/daily_candidates.jsonl を作成する雛形。
 * - 非公式/不正は除外、重複排除、norm 補完、Step Summary 向けの統計出力。
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

function normText(s){
  return String(s||'')
    .toLowerCase()
    .replace(/\s+/g,' ')
    .replace(/[‐‑‒–—―]/g,'-')
    .replace(/[〜～]/g,'~')
    .trim();
}
function keyOf(entry){
  const p = entry?.clip?.provider || entry?.provider || '';
  const id = entry?.clip?.id || entry?.id || '';
  const ans = entry?.answers?.canonical || entry?.title || entry?.track?.name || '';
  return `${normText(p)}|${normText(id)}|${normText(ans)}`;
}
function readJSON(p, fallback=null){
  try{ return JSON.parse(fs.readFileSync(p,'utf-8')); }catch{ return fallback; }
}
function* readJSONL(p){
  const text = fs.readFileSync(p,'utf-8');
  for (const line of text.split(/\r?\n/)){
    const s = line.trim(); if (!s) continue;
    try{ yield JSON.parse(s); }catch{}
  }
}
function isOfficial(entry, allow){
  const p = entry?.clip?.provider || entry?.provider || '';
  const id = entry?.clip?.id || entry?.id || '';
  if (!p || !id) return false;
  if (!allow) return true; // allowlist 無しなら v0 は通す
  const a = allow?.[p]; if (!a) return false;
  // allowlist には id または prefix を入れられる
  return Boolean(a[id] || a.__prefixes?.some(pr => id.startsWith(pr)));
}
function attachNorm(entry){
  entry.norm = entry.norm || {};
  if (!entry.norm.title && entry.title) entry.norm.title = normText(entry.title);
  const ans = entry?.answers?.canonical || entry.title || entry?.track?.name || '';
  if (!entry.norm.answer && ans) entry.norm.answer = normText(ans);
  if (!entry.norm.game && entry.game) entry.norm.game = normText(entry.game);
  if (!entry.norm.composer && entry.composer) entry.norm.composer = normText(entry.composer);
  if (!entry.norm.series && entry.series) entry.norm.series = normText(entry.series);
  return entry;
}
async function main(){
  const out = 'public/app/daily_candidates.jsonl';
  const allow = readJSON('sources/allowlist.json', null);
  const stats = { in:0, kept:0, dup:0, unofficial:0, malformed:0 };
  const seen = new Set();
  const kept = [];
  for (const c of readJSONL('sources/seed_candidates.jsonl')){
    stats.in++;
    if (!c || typeof c!=='object'){ stats.malformed++; continue; }
    if (!isOfficial(c, allow)){ stats.unofficial++; continue; }
    attachNorm(c);
    const k = keyOf(c);
    if (seen.has(k)){ stats.dup++; continue; }
    seen.add(k);
    kept.push(c); stats.kept++;
  }
  await fsp.mkdir(path.dirname(out), { recursive:true });
  await fsp.writeFile(out, kept.map(o=>JSON.stringify(o)).join('\n')+'\n', 'utf-8');
  // Step Summary
  const s = [
    '### candidates (ingest) details',
    `- in: **${stats.in}**`,
    `- kept: **${stats.kept}**`,
    `- dup: ${stats.dup}`,
    `- unofficial: ${stats.unofficial}`,
    `- malformed: ${stats.malformed}`,
  ];
  if (process.env.GITHUB_STEP_SUMMARY){
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, s.join('\n')+'\n');
  } else {
    console.log(s.join('\n'));
  }
}
main().catch(e=>{ console.error(e); process.exit(1); });
