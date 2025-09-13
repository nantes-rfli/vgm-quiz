#!/usr/bin/env node
/**
 * v1.13 MVP (dry-run): “1問/日” 候補数の把握とKPIの暫定出力
 * - 破壊的変更なし。publishはしない（生成もcommitもしない）
 * - datasetの中から埋め込み可能（Apple/YouTube）の候補数を数える
 * - 将来の本番実装に向けて、スキップ/繰越の判断材料を出力
 */

import fs from 'node:fs';
import path from 'node:path';

const SUMMARY = process.env.GITHUB_STEP_SUMMARY;

function readJSON(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return null; }
}

function* walk(obj) {
  if (Array.isArray(obj)) {
    for (const it of obj) yield* walk(it);
  } else if (obj && typeof obj === 'object') {
    yield obj;
    for (const v of Object.values(obj)) yield* walk(v);
  }
}

function findTracks(dataset) {
  // datasetのどこかに { media: { provider, id } } を含む配列があるはず、という前提で探索
  const candidates = [];
  for (const o of walk(dataset)) {
    if (o && typeof o === 'object' && o.media && o.media.provider && o.media.id) {
      candidates.push(o);
    }
  }
  return candidates;
}

const datasetPath = path.resolve('public/build/dataset.json');
const ds = readJSON(datasetPath);
if (!ds) {
  console.log('[oneq] WARN: dataset not found or invalid:', datasetPath);
  if (SUMMARY) fs.appendFileSync(SUMMARY, `\n**oneq dry-run**: dataset not found: \`${datasetPath}\`\n`);
  process.exit(0); // 成功扱い（dry-run）
}

const all = findTracks(ds);
const apple = all.filter(t => String(t?.media?.provider).toLowerCase() === 'apple');
const youtube = all.filter(t => String(t?.media?.provider).toLowerCase() === 'youtube');

// 簡易ユニーク性（将来は直近N日の一意性ロックと統合）
const key = t => [t?.game, t?.track?.title, t?.track?.composer, t?.media?.provider, t?.media?.id].map(x=>String(x||'')).join('｜');
const uniq = new Set();
const uniqueCandidates = [];
for (const t of [...apple, ...youtube]) {
  const k = key(t);
  if (!uniq.has(k)) { uniq.add(k); uniqueCandidates.push(t); }
}

const pick = uniqueCandidates[0] || null;

const lines = [];
lines.push(`# oneq dry-run（v1.13 MVP）`);
lines.push(`- dataset: \`${datasetPath}\``);
lines.push(`- 全候補: **${all.length}**`);
lines.push(`  - Apple: **${apple.length}**`);
lines.push(`  - YouTube: **${youtube.length}**`);
lines.push(`- 一意化後の候補（単純ユニーク）: **${uniqueCandidates.length}**`);
if (pick) {
  const p = pick;
  const title = p?.track?.title || '(unknown title)';
  const game = p?.game || '(unknown game)';
  const comp = p?.track?.composer || '(unknown composer)';
  lines.push(`- 代表候補（サンプル）: **${title}** / ${game} / ${comp} / ${p?.media?.provider}:${p?.media?.id}`);
} else {
  lines.push(`- 代表候補（サンプル）: なし`);
}

const out = lines.join('\n');
console.log(out);
if (SUMMARY) {
  fs.appendFileSync(SUMMARY, `\n${out}\n`);
}

process.exit(0);
