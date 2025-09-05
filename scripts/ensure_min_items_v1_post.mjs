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

function hasRequiredFields(it) {
  if (!it || typeof it !== 'object') return false;
  const titleOk = !!(it.title || it.track?.name || it.game?.name);
  const gameOk = !!(it.game && (it.game.name || it.game.series));
  const composerOk = !!(it.track && it.track.composer);
  const clipOk = !!(it.clip && it.clip.provider && it.clip.id);
  const answerOk = !!(it.answers && it.answers.canonical);
  return titleOk && gameOk && composerOk && clipOk && answerOk;
}

function pruneInvalidDates(list, keepDate) {
  return list.filter(d => String(d.date) === String(keepDate) || (Array.isArray(d.items) && d.items.length > 0 && hasRequiredFields(d.items[0])));
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

function normText(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[‐‑‒–—―]/g, '-')    // dash variants → hyphen
    .replace(/[〜～]/g, '~')
    .trim();
}

function ensureNorm(entry) {
  entry.norm = entry.norm || {};
  const composer = entry?.track?.composer;
  const series = entry?.game?.series || entry?.game?.name;
  entry.norm.composer = entry.norm.composer || normText(composer);
  entry.norm.series = entry.norm.series || normText(series);
  entry.norm.game = entry.norm.game || normText(entry?.game?.name);
  entry.norm.title = entry.norm.title || normText(entry?.title || entry?.track?.name || entry?.game?.name);
  entry.norm.answer = entry.norm.answer || normText(entry?.answers?.canonical);
}

function scoreOf(c) {
  const s = Number(c.score ?? c.s ?? c.rank ?? 0);
  return Number.isFinite(s) ? s : 0;
}

function hasMinimalMedia(c) {
  return !!(c?.clip?.provider && c?.clip?.id);
}

function buildItem(c) {
  // media/clip を相互補完（どちらでも下流が読めるようにする）
  const srcMedia = c.media || c.clip || null;
  const mediaObj = srcMedia ? { provider: srcMedia.provider, id: srcMedia.id, start: srcMedia.start, duration: srcMedia.duration } : null;

  // フィールドの穴埋め（validator必須フィールド）
  const fallbackTitle = c.title || c.track?.name || c.game?.name || c.norm?.title || c.norm?.answer;
  const fallbackGameName = (c.game && (c.game.name || c.game.series))
    ? (c.game.name || c.game.series)
    : (c.norm?.game || c.norm?.series || c.answers?.canonical || fallbackTitle || 'Unknown');
  const fallbackComposer = (c.track && c.track.composer)
    ? c.track.composer
    : (c.norm?.composer || 'Unknown');
  const answers = c.answers && c.answers.canonical
    ? c.answers
    : { canonical: fallbackGameName };

  const game = c.game && (c.game.name || c.game.series)
    ? c.game
    : { name: fallbackGameName };

  const track = c.track && c.track.composer
    ? c.track
    : { ...(c.track || {}), composer: fallbackComposer };

  const item = {
    title: fallbackTitle || fallbackGameName,
    game,
    track: { name: (c.track && c.track.name) ? c.track.name : (fallbackTitle || fallbackGameName), composer: track.composer },
    clip: c.clip || mediaObj,
    media: c.media || mediaObj,
    answers,
    sources: Array.isArray(c.sources) ? c.sources : undefined
  };
  ensureNorm(item);
  // debug: 出力アイテムの主要キーをログに出す
  try {
    console.log('[ensure_min_items] item keys:', Object.keys(item));
  } catch {}
  return item;
}

async function run() {
  const args = parseArgs(process.argv);
  const raw = await fs.readFile(args.daily, 'utf8');
  const json = JSON.parse(raw);
  const originalByDate = json.by_date;
  const by = normalizeByDate(originalByDate);
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

  // 不正エントリを prune（今回対象日以外で items が空 or 必須欠落のものは落とす）
  const pruned = pruneInvalidDates(by, targetDate);
  // 書き戻し（by_date の形状は元に合わせる: 配列で保存している前提）
  // validator 互換のため、原則 `{ "YYYY-MM-DD": { items:[...] } }` 形に整えて保存する
  function toObjectItems(arr) {
    const obj = {};
    for (const d of pruned) {
      obj[d.date] = { items: d.items || [] };
    }
    return obj;
  }
  // 既存がオブジェクトだった場合はそれに合わせる。配列だった場合もオブジェクトに昇格させる（検証安定性のため）
  json.by_date = toObjectItems(pruned);
  await fs.writeFile(args.daily, JSON.stringify(json, null, 2), 'utf8');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
