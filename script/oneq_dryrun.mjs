#!/usr/bin/env node
/**
 * v1.13 MVP (dry-run): “1問/日” 候補数の把握とKPIの暫定出力
 * - 破壊的変更なし。publishはしない（生成もcommitもしない）
 * - datasetの中から埋め込み可能（Apple/YouTube）の候補数を数える
 * - 将来の本番実装に向けて、スキップ/繰越の判断材料を出力
 */

import fs from 'node:fs';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

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
  // 1) まず標準の dataset.tracks を見る（v1.12 以降はここが正）
  if (dataset && Array.isArray(dataset.tracks)) return dataset.tracks;
  // 2) 次善: オブジェクト内から music的な要素を総当たり探索（後方互換）
  const rows = [];
  for (const o of walk(dataset)) {
    if (o && typeof o === 'object' && 'title' in o && 'game' in o) rows.push(o);
  }
  return rows;
}

function buildMediaMap() {
  // 任意のローカルマッピング（Docs管理）: docs/data/media_map.json
  const mapPath = path.resolve('docs/data/media_map.json');
  if (!fs.existsSync(mapPath)) return null;
  try {
    const rows = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
    const byId = new Map();
    for (const r of Array.isArray(rows) ? rows : []) {
      const k = String(r.track_id || '').trim();
      const prov = String(r.provider || '').toLowerCase().trim();
      const mid = String(r.id || '').trim();
      if (!k || !prov || !mid) continue;
      if (mid === 'FILL_ME' || /^FILL_ME/i.test(mid)) continue; // placeholderは除外
      byId.set(k, { provider: prov, id: mid });
    }
    return { byId, mapPath };
  } catch { return null; }
}

const datasetPath = path.resolve('public/build/dataset.json');
let ds = readJSON(datasetPath);
let datasetOrigin = `local:${datasetPath}`;

// ローカルに無ければ GitHub Pages から取得（読み取り専用）
if (!ds) {
  const repo = process.env.GITHUB_REPOSITORY || 'nantes-rfli/vgm-quiz';
  const [owner, name] = repo.split('/');
  const base = process.env.ONEQ_DATASET_BASE || `https://${owner}.github.io/${name}`;
  const candidates = [
    process.env.ONEQ_DATASET_URL,
    `${base}/build/dataset.json`,
    `${base}/app/build/dataset.json`
  ].filter(Boolean);

  async function fetchJSON(url) {
    try {
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(url, { signal: ctrl.signal, headers: { 'accept': 'application/json' } });
      clearTimeout(to);
      if (!res.ok) return null;
      return await res.json();
    } catch { return null; }
  }

  for (const url of candidates) {
    ds = await fetchJSON(url);
    if (ds) { datasetOrigin = `remote:${url}`; break; }
    await sleep(200);
  }
}

if (!ds) {
  const msg = `**oneq dry-run**: dataset not found (tried local and remote). last tried: \`${datasetPath}\``;
  console.log('[oneq] WARN:', msg);
  if (SUMMARY) fs.appendFileSync(SUMMARY, `\n${msg}\n`);
  process.exit(0); // 成功扱い（dry-run）
}

const all = findTracks(ds);

// provider/id は dataset に含まれない構成が多いため、Docs側の media_map を優先的に使う
const mediaMap = buildMediaMap();
function resolveMedia(t) {
  // 優先: track/id で引く
  const tid = (t['track/id'] || t.track_id || '').toString();
  if (mediaMap?.byId && tid && mediaMap.byId.has(tid)) return mediaMap.byId.get(tid);
  // 次: dataset 内に media があれば使う（後方互換）
  if (t.media && t.media.provider && t.media.id) {
    return { provider: String(t.media.provider).toLowerCase(), id: String(t.media.id) };
  }
  return null;
}

const resolved = all.map(t => ({ t, m: resolveMedia(t) }));
const apple = resolved.filter(x => x.m?.provider === 'apple');
const youtube = resolved.filter(x => x.m?.provider === 'youtube');
const covered = resolved.filter(x => !!x.m);
const missing = all.length - covered.length;

// 簡易ユニーク性（将来は直近N日の一意性ロックと統合）
const key = t => [t?.game || t.game, t?.track?.title || t.title, t?.track?.composer || t.composer, (resolveMedia(t)||{}).provider || '', (resolveMedia(t)||{}).id || ''].map(x=>String(x||'')).join('｜');
const uniq = new Set();
const uniqueCandidates = [];
for (const x of [...apple, ...youtube]) {
  const k = key(x.t);
  if (!uniq.has(k)) { uniq.add(k); uniqueCandidates.push(x); }
}

const pick = uniqueCandidates[0]?.t || null;

const lines = [];
lines.push(`# oneq dry-run（v1.13 MVP）`);
lines.push(`- dataset: ${datasetOrigin}`);
lines.push(`- 全トラック数: **${all.length}**`);
lines.push(`- メディア情報の被覆: **${covered.length} / ${all.length}**（未解決: ${missing}）`);
lines.push(`  - Apple: **${apple.length}**`);
lines.push(`  - YouTube: **${youtube.length}**`);
if (mediaMap?.mapPath) {
  lines.push(`- media_map: local:\`${mediaMap.mapPath}\` を使用`);
} else {
  lines.push(`- media_map: なし（Docs に \`docs/data/media_map.json\` を作成すると検出可能になります）`);
}
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
