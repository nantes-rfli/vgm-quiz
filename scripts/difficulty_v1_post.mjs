#!/usr/bin/env node
/**
 * difficulty_v1_post.mjs
 * daily_auto.json 生成後に、当日分 difficulty を 0.0..1.0 で補完する軽量ポストプロセッサ。
 *
 * 入力:  --in  public/app/daily_auto.json
 *        --date YYYY-MM-DD (JST基準。未指定なら今日)
 * 出力:  上書き保存（--out 指定時は別ファイルへ）
 *
 * ルール（MVP; 将来バージョンで学習ベースへ置換可能なようにシンプルな足し引き）
 *  - 既存 difficulty が数値の場合は尊重（--force のみ上書き）
 *  - 周知度の proxy を用いた減点（=易化）
 *     * 作曲者の出現頻度が多い（全期間）: -0.12（>=4件）
 *     * シリーズ/ゲームの出現頻度が多い:    -0.10（>=4件）
 *     * タイトルに Opening/Main Theme/序曲 など: -0.08
 *     * エイリアス（answers.aliases）が多い（>=3）: -0.07
 *  - 時代による加点（=難化；暫定）
 *     * 年 < 1995: +0.08
 *     * 年 > 2015: +0.04
 *  - clamp 0..1
 */

import fs from 'node:fs/promises';

function todayJST() {
  const now = new Date();
  const tz = 'Asia/Tokyo';
  const z = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(now)
    .reduce((o, p) => (o[p.type] = p.value, o), {});
  return `${z.year}-${z.month}-${z.day}`;
}

function parseArgs(argv) {
  const a = { force: false };
  for (let i = 2; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--in') a.in = argv[++i];
    else if (t === '--out') a.out = argv[++i];
    else if (t === '--date') a.date = argv[++i];
    else if (t === '--force') a.force = true;
  }
  if (!a.in) throw new Error('missing --in <daily_auto.json>');
  if (!a.date) a.date = todayJST();
  return a;
}

function clamp(x, lo=0, hi=1) { return Math.max(lo, Math.min(hi, x)); }
function norm(s) { return String(s || '').trim().toLowerCase(); }

function getEntries(by_date){
  if (Array.isArray(by_date)){
    return by_date.map(d => {
      if (d && typeof d === 'object' && 'date' in d){
        const entry = Array.isArray(d.items) ? d.items[0] : d;
        return { date: d.date, entry };
      }
      return null;
    }).filter(Boolean);
  }
  if (by_date && typeof by_date === 'object'){
    return Object.entries(by_date).map(([date, v]) => {
      const entry = Array.isArray(v?.items) ? v.items[0] : v;
      return { date, entry };
    });
  }
  return [];
}

function buildFrequencies(entries) {
  const composer = new Map();
  const series = new Map();
  const game = new Map();
  for (const d of entries) {
    const it = d.entry;
    const c = norm(it?.track?.composer || it?.composer);
    const s = norm(it?.game?.series || it?.game?.name || it?.game);
    const g = norm(it?.game?.name || it?.game);
    if (c) composer.set(c, (composer.get(c) || 0) + 1);
    if (s) series.set(s, (series.get(s) || 0) + 1);
    if (g) game.set(g, (game.get(g) || 0) + 1);
  }
  return { composer, series, game };
}

function hasOpeningKeyword(entry) {
  const t = [entry?.title, entry?.track?.name].map(norm).join(' • ');
  return /(opening|prologue|title|main\s*theme|序曲|ｵｰﾌﾟﾆﾝｸﾞ|オープニング|タイトル)/i.test(t);
}

function scoreDifficulty(item, freqs) {
  let d = 0.6; // base
  const c = norm(item.track?.composer);
  const s = norm(item.game?.series || item.game?.name);
  const y = Number(item.game?.year) || null;
  const aliases = Array.isArray(item.answers?.aliases) ? item.answers.aliases : [];

  if (c && (freqs.composer.get(c) || 0) >= 4) d -= 0.12;
  if (s && (freqs.series.get(s) || 0) >= 4) d -= 0.10;
  if (hasOpeningKeyword(item)) d -= 0.08;
  if (aliases.length >= 3) d -= 0.07;

  if (y != null && y < 1995) d += 0.08;
  if (y != null && y > 2015) d += 0.04;

  return clamp(d, 0, 1);
}

async function run() {
  const args = parseArgs(process.argv);
  const raw = await fs.readFile(args.in, 'utf8');
  const json = JSON.parse(raw);
  const entries = getEntries(json.by_date);

  const freqs = buildFrequencies(entries);

  const target = entries.find(d => String(d.date) === String(args.date));
  if (!target) {
    console.warn(`[warn] by_date has no ${args.date}; nothing to do.`);
  } else {
    const item = target.entry || {};
    const hasNumeric = typeof item.difficulty === 'number' && isFinite(item.difficulty);
    if (!hasNumeric || args.force){
      item.difficulty = scoreDifficulty(item, freqs);
      console.log(`[difficulty] date=${args.date} difficulty=${item.difficulty.toFixed(2)}`);
    }
    // write back flat
    if (json.by_date && typeof json.by_date === 'object' && !Array.isArray(json.by_date)){
      json.by_date[String(args.date)] = item;
    } else {
      json.by_date = { [String(args.date)]: item };
    }
  }

  const outPath = args.out || args.in;
  await fs.writeFile(outPath, JSON.stringify(json, null, 2), 'utf8');
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
