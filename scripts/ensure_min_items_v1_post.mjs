#!/usr/bin/env node
/**
 * ensure_min_items_v1_post.mjs
 * daily_auto.json の当日（または --date 指定日）の items が 0 件なら、
 * 候補 JSONL から最良の1件を構築して最低1件に補うポストプロセス。
 *
 * 目的: 収集が薄い日でも UI/PR が空にならないようにするための最後の砦（MVP）。
 * その後の distractors/difficulty が choices / difficulty を補完する前提。
 */

import fs from 'node:fs/promises';
import fsSync from 'node:fs';

function parseArgs(argv) {
  const a = {
    daily: 'public/app/daily_auto.json',
    date: null,
    // 優先順に探す
    candidates: [
      'public/app/daily_candidates_scored_enriched_start.jsonl',
      'public/app/daily_candidates_scored_enriched.jsonl',
      'public/app/daily_candidates_scored.jsonl',
      'public/app/daily_candidates_merged.jsonl',
      'public/app/daily_candidates.jsonl'
    ]
  };
  for (let i = 2; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--daily') a.daily = argv[++i];
    else if (t === '--date') a.date = argv[++i];
    else if (t === '--candidates') a.candidates = argv[++i].split(',');
  }
  return a;
}

function normalizeByDate(by_date) {
  if (Array.isArray(by_date)) {
    return by_date
      .map((d) => (d && typeof d === 'object' && 'date' in d) ? d
        : (typeof d === 'string' ? { date: d, items: [] } : null))
      .filter(Boolean);
  }
  if (by_date && typeof by_date === 'object') {
    return Object.entries(by_date).map(([date, v]) => {
      const items = Array.isArray(v?.items) ? v.items : Array.isArray(v) ? v : [];
      return { date, items };
    });
  }
  return [];
}

function pickCandidatesFile(paths) {
  for (const p of paths) {
    if (fsSync.existsSync(p)) return p;
  }
  return null;
}

function readJsonl(path) {
  if (!path || !fsSync.existsSync(path)) return [];
  const lines = fsSync.readFileSync(path, 'utf8').split(/\r?\n/);
  const out = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    try { out.push(JSON.parse(line)); } catch {}
  }
  return out;
}

function scoreOf(c) {
  const s = Number(c.score ?? c.s ?? c.rank ?? 0);
  return Number.isFinite(s) ? s : 0;
}

function hasMinimalMedia(c) {
  return !!(c?.clip?.provider && c?.clip?.id);
}

function buildItem(c) {
  return {
    title: c.title || c.track?.name || c.game?.name,
    game: c.game || null,
    track: c.track || null,
    clip: c.clip || null,
    answers: c.answers || null,
    sources: Array.isArray(c.sources) ? c.sources : undefined,
    // choices と difficulty は後段で補完
  };
}

async function run() {
  const args = parseArgs(process.argv);
  const raw = await fs.readFile(args.daily, 'utf8');
  const json = JSON.parse(raw);
  const by = normalizeByDate(json.by_date);
  if (!by.length) {
    console.warn('[ensure_min_items] by_date is empty; nothing to do.');
    return;
  }
  const dates = by.map(d => d.date).sort();
  const targetDate = args.date || dates[dates.length - 1];
  let target = by.find(d => String(d.date) === String(targetDate));
  if (!target) {
    target = { date: targetDate, items: [] };
    by.push(target);
  }
  if ((target.items?.length || 0) >= 1) {
    console.log(`[ensure_min_items] date=${targetDate} already has items=${target.items.length}, skip.`);
  } else {
    const candPath = pickCandidatesFile(args.candidates);
    const cands = readJsonl(candPath)
      .filter(hasMinimalMedia)
      .sort((a, b) => scoreOf(b) - scoreOf(a));
    const best = cands[0];
    if (!best) {
      console.warn(`[ensure_min_items] no suitable candidates found (checked: ${args.candidates.join(', ')})`);
    } else {
      const item = buildItem(best);
      target.items = [item];
      console.log(`[ensure_min_items] date=${targetDate} injected 1 item from ${candPath}`);
    }
  }
  // 書き戻し（by_date の形状は元に合わせる: 配列で保存している前提）
  json.by_date = by;
  await fs.writeFile(args.daily, JSON.stringify(json, null, 2), 'utf8');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
