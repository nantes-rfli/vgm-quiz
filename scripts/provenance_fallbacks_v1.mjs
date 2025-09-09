#!/usr/bin/env node
/**
 * provenance_fallbacks_v1.mjs
 *  - --jsonl <path>: JSON Lines (candidates)
 *  - --json  <path>: JSON (authoring today)
 * 既存の meta.provenance が欠けている、または必須キーが不足している場合に最小項目を補完する。
 * v1 最小: source / provider / id / collected_at / hash / license_hint
 * - idempotent（複数回の実行で二重加筆しない）
 * - 可能であれば top-level の item.provenance も meta.provenance と同一化（後方互換）
 */

import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

function sha1(s) {
  return 'sha1:' + createHash('sha1').update(String(s)).digest('hex');
}
function sha1hex(s){ return createHash('sha1').update(String(s)).digest('hex'); }

function ensureProvenance(item, nowIso) {
  if (!item || typeof item !== 'object') return { fixed: false, item };
  item.meta = item.meta || {};
  const basePv = (item.meta && item.meta.provenance) || item.provenance || {};
  const pv = { ...basePv };

  // 必須フィールドを埋める（idempotent）
  if (!pv.source) pv.source = basePv.source || 'seed';
  if (!pv.provider && item.provider) pv.provider = item.provider;
  if (!pv.id && (item.id || (item.media && item.media.id))) pv.id = item.id || item.media.id;
  if (!pv.collected_at) pv.collected_at = nowIso;
  if (!pv.license_hint) pv.license_hint = 'unknown';

  // ---- STUB 既定 & 正規化（v1.10）
  const baseForHash = [
    item?.norm?.title || item.title,
    item?.norm?.game || (item.game && (item.game.name || item.game)),
    item?.norm?.composer || item.composer,
    item.answers && item.answers.canonical
  ].filter(Boolean).join('|');
  if (!pv.provider || !pv.id) {
    if (!pv.provider) pv.provider = 'stub';
    if (!pv.id) pv.id = 'stub:' + sha1hex(baseForHash);
    if (!basePv.license_hint) pv.license_hint = 'stub';
  }
  if (pv.provider === 'stub') {
    if (!pv.id || !/^stub:/.test(String(pv.id))) {
      pv.id = 'stub:' + sha1hex(baseForHash);
    }
    if (!pv.license_hint || pv.license_hint === 'unknown') {
      pv.license_hint = 'stub';
    }
  }

  if (!pv.hash) {
    // provider+id を優先。なければ title|game|answers を畳み込む。
    const base = pv.provider && pv.id ? `${pv.provider}:${pv.id}`
      : [item.title, item.game && (item.game.name || item.game), item.answers && item.answers.canonical]
          .filter(Boolean).join('|');
    pv.hash = sha1(base);
  }

  // --- 正規化の最終保証：stub id を必ず "stub:<sha1hex>" へ
  if (pv.provider === 'stub' && (!pv.id || !/^stub:/.test(String(pv.id)))) {
    pv.id = 'stub:' + sha1hex(baseForHash);
  }
  // 書き戻しはディープコピー（参照共有を避ける）
  const before = JSON.stringify(item.meta?.provenance || {});
  item.meta.provenance = JSON.parse(JSON.stringify(pv));
  item.provenance = JSON.parse(JSON.stringify(pv)); // 後方互換
  const after = JSON.stringify(item.meta.provenance);
  return { fixed: before !== after, item };
}

async function runJsonl(path) {
  const raw = await readFile(path, 'utf8');
  const lines = raw.split(/\r?\n/).filter(Boolean);
  const nowIso = new Date().toISOString();
  let fixed = 0;
  const outLines = lines.map(line => {
    try {
      const obj = JSON.parse(line);
      const res = ensureProvenance(obj, nowIso);
      if (res.fixed) fixed++;
      return JSON.stringify(res.item);
    } catch {
      return line; // 破損行は素通し
    }
  });
  await writeFile(path, outLines.join('\n') + '\n', 'utf8');
  console.log(`[provenance-fallbacks] jsonl fixed=${fixed} / total=${lines.length}`);
}

async function runJson(path) {
  const data = JSON.parse(await readFile(path, 'utf8'));
  const nowIso = new Date().toISOString();
  let fixed = 0, total = 0;

  if (Array.isArray(data.items)) {
    data.items = data.items.map(it => {
      total++;
      const res = ensureProvenance(it, nowIso);
      if (res.fixed) fixed++;
      return res.item;
    });
  } else if (data.item) {
    total = 1;
    const res = ensureProvenance(data.item, nowIso);
    if (res.fixed) fixed++;
    data.item = res.item;
  }
  await writeFile(path, JSON.stringify(data, null, 2), 'utf8');
  console.log(`[provenance-fallbacks] json fixed=${fixed} / total=${total}`);
}

async function main() {
  const args = process.argv.slice(2);
  const idxJsonl = args.indexOf('--jsonl');
  const idxJson  = args.indexOf('--json');
  if (idxJsonl >= 0 && args[idxJsonl+1]) {
    return runJsonl(args[idxJsonl+1]);
  }
  if (idxJson >= 0 && args[idxJson+1]) {
    return runJson(args[idxJson+1]);
  }
  console.error('Usage: node scripts/provenance_fallbacks_v1.mjs (--jsonl <path> | --json <path>)');
  process.exit(2);
}

main().catch(e => { console.error(e); process.exit(1); });

