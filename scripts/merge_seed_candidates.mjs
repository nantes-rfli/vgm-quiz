#!/usr/bin/env node
/**
 * merge_seed_candidates.mjs
 * 既存の candidates JSONL に、手動シード（sources/seed_candidates.jsonl）をマージするユーティリティ。
 * - 重複は除外（provider+id / answers.canonical の正規化キーで判定）
 * - allowlist（sources/allowlist.json）があれば、provider別の簡易フィルタを適用（任意）
 *
 * 使い方:
 *   node scripts/merge_seed_candidates.mjs \
 *     --in public/app/daily_candidates.jsonl \
 *     --seed sources/seed_candidates.jsonl \
 *     --allow sources/allowlist.json \
 *     --out public/app/daily_candidates_merged.jsonl
 */

import fs from 'node:fs';

function parseArgs(argv) {
  const a = {};
  for (let i = 2; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--in') a.in = argv[++i];
    else if (t === '--seed') a.seed = argv[++i];
    else if (t === '--out') a.out = argv[++i];
    else if (t === '--allow') a.allow = argv[++i];
    else if (t === '--help' || t === '-h') a.help = true;
  }
  return a;
}

function usage() {
  console.log(`Usage:
  node scripts/merge_seed_candidates.mjs --in <candidates.jsonl> --seed sources/seed_candidates.jsonl --out <merged.jsonl> [--allow sources/allowlist.json]
`);
}

const args = parseArgs(process.argv);
if (args.help || !args.in || !args.seed || !args.out) {
  usage();
  process.exit(args.help ? 0 : 1);
}

function readJsonl(path) {
  if (!fs.existsSync(path)) return []; // 無ければ空
  const lines = fs.readFileSync(path, 'utf8').split(/\r?\n/);
  const arr = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    try { arr.push(JSON.parse(line)); } catch {}
  }
  return arr;
}

function normText(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[‐‑‒–—―]/g, '-')    // dash variants → hyphen
    .replace(/[〜～]/g, '~')
    .trim();
}

function keyOf(entry) {
  const p = entry?.clip?.provider || entry?.provider;
  const id = entry?.clip?.id || entry?.id;
  const ans = entry?.answers?.canonical || entry?.title || entry?.track?.name;
  return `${normText(p)}|${normText(id)}|${normText(ans)}`;
}

function ensureNorm(entry) {
  // 下流(score/difficulty)が参照する最小限の正規化フィールドを補う
  entry.norm = entry.norm || {};
  const composer = entry?.track?.composer;
  const series = entry?.game?.series;
  const game = entry?.game?.name;
  const title = entry?.title || entry?.track?.name || entry?.game?.name;
  const answer = entry?.answers?.canonical;

  if (!entry.norm.composer) entry.norm.composer = normText(composer);
  if (!entry.norm.series) entry.norm.series = normText(series || game);
  if (!entry.norm.game) entry.norm.game = normText(game);
  if (!entry.norm.title) entry.norm.title = normText(title);
  if (!entry.norm.answer) entry.norm.answer = normText(answer);

  // 念のため clip.provider も正規化の別名を置いておく（使われることがあるため）
  if (!entry.norm.provider) entry.norm.provider = normText(entry?.clip?.provider || entry?.provider);

  return entry;
}

function allowFilter(entry, allow) {
  if (!allow) return true;
  const provider = String(entry?.clip?.provider || entry?.provider || '').toLowerCase();
  if (provider === 'youtube') {
    // 許可チャンネルID が指定されている場合に限り通す（無ければ通す）
    const list = allow.youtubeChannels || null;
    if (!list) return true;
    const ch = String(entry?.clip?.channel_id || entry?.channel_id || '').toLowerCase();
    return ch && list.map(s => String(s).toLowerCase()).includes(ch);
  }
  if (provider === 'apple') {
    // Publisher 名称の簡易チェック（任意）
    const pubs = allow.applePublishers || null;
    if (!pubs) return true;
    const pub = String(entry?.track?.publisher || entry?.publisher || '').toLowerCase();
    return pub && pubs.map(s => String(s).toLowerCase()).some(p => pub.includes(p));
  }
  return true;
}

function writeJsonl(path, arr) {
  const out = fs.createWriteStream(path, { encoding: 'utf8' });
  for (const obj of arr) out.write(JSON.stringify(obj) + '\n');
  out.end();
}

function safeReadJSON(path) {
  try {
    if (!fs.existsSync(path)) return null;
    return JSON.parse(fs.readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

function run() {
  const base = readJsonl(args.in);
  const seeds = readJsonl(args.seed);
  const allow = args.allow ? safeReadJSON(args.allow) : null;

  const seen = new Set(base.map(keyOf));
  let added = 0, skipped = 0;
  for (const s of seeds) {
    if (!allowFilter(s, allow)) { skipped++; continue; }
    ensureNorm(s);
    const k = keyOf(s);
    if (seen.has(k)) { skipped++; continue; }
    base.push(s);
    seen.add(k);
    added++;
  }
  writeJsonl(args.out, base);
  console.log(`[merge] base=${base.length - added} seeds=${seeds.length} added=${added} skipped=${skipped} out=${args.out}`);
}

run();
