#!/usr/bin/env node
/**
 * distractors_v1_post.mjs
 * daily_auto.json 生成後に、当日分の items[*].choices を補完/強化する軽量ポストプロセッサ（v1.7.1: 多様性を強化）。
 *
 * 入力:  --in  public/app/daily_auto.json
 *        --date YYYY-MM-DD (JST基準。未指定なら今日)
 * 出力:  上書き保存（--out 指定時は別ファイルへ）
 *
 * 方針（MVP）:
 *  - 正解: item.answers.canonical を採用
 *  - 候補プール: daily_auto.by_date[*].items の answers.canonical を横断収集
 *  - スコアリング（高い順に採用）:
 *      +2: 同作曲者（track.composer が一致）
 *      +1: 同シリーズ/同ゲーム（game.series または game.name が部分一致）
 *     +0.5: 年が近い（|year - year'| <= 2）
 *  - 3件に満たない場合はランダム補完（重複・同値・正解は除外）
 *  - 既に choices が十分揃っている場合は変更しない（--force で再生成）
 *
 * 制約・守ること:
 *  - choices 内に正解（canonical）を必ず含める
 *  - choices はユニーク 4 件を目標（重複を除去）
 *  - 既存の item 構造は壊さない（choices のみ変更）
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

function norm(s) {
  return String(s || '').trim().toLowerCase();
}

function uniq(arr) {
  return [...new Set(arr)];
}

function sample(arr, k, rng=Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, k);
}

function pickDistractors(target, pool, k = 3) {
  const t = target;
  const correct = norm(t?.answers?.canonical);
  if (!correct) return [];
  const series = norm(t?.game?.series || t?.game?.name);
  const composer = norm(t?.track?.composer);
  const year = Number(t?.game?.year) || null;

  const scored = [];
  for (const cand of pool) {
    const ans = norm(cand.answers?.canonical);
    if (!ans || ans === correct) continue;

    let score = 0;
    const c_series = norm(cand.game?.series || cand.game?.name);
    const c_composer = norm(cand.track?.composer);
    const c_year = Number(cand.game?.year) || null;

    if (composer && c_composer && composer === c_composer) score += 2;
    if (series && c_series && (series === c_series || c_series.includes(series) || series.includes(c_series))) score += 1;
    if (year != null && c_year != null && Math.abs(year - c_year) <= 2) score += 0.5;

    // 後段の多様性制御で使うメタも保持
    scored.push({ cand, score, ans, c_series, c_composer });
  }

  // スコア降順 → 同点はランダム
  scored.sort((a, b) => b.score - a.score || (Math.random() - 0.5));

  // v1.7.1: 多様性制約
  const picked = [];
  const seen = new Set([correct]);
  const counts = { series: new Map(), composer: new Map() };
  const maxSameSeries = 1;   // 正解と同シリーズのダミーは最大1
  const maxSameComposer = 1; // 同一作曲者は最大1（ダミー内）

  function canTake(s) {
    if (seen.has(s.ans)) return false;
    const sameSeries = series && s.c_series && (s.c_series === series);
    if (sameSeries) {
      const n = counts.series.get(series) || 0;
      if (n >= maxSameSeries) return false;
    }
    if (s.c_composer) {
      const n = counts.composer.get(s.c_composer) || 0;
      if (n >= maxSameComposer) return false;
    }
    return true;
  }

  for (const s of scored) {
    if (picked.length >= k) break;
    if (!canTake(s)) continue;
    picked.push(s.cand.answers.canonical);
    seen.add(s.ans);
    if (series && s.c_series === series) counts.series.set(series, (counts.series.get(series) || 0) + 1);
    if (s.c_composer) counts.composer.set(s.c_composer, (counts.composer.get(s.c_composer) || 0) + 1);
  }

  // 足りない場合は制約を緩めて充足
  if (picked.length < k) {
    for (const s of scored) {
      if (picked.length >= k) break;
      if (seen.has(s.ans)) continue;
      picked.push(s.cand.answers.canonical);
      seen.add(s.ans);
    }
  }

  return uniq(picked).slice(0, k);
}

function normalizeByDate(by_date) {
  // 受け取り形に幅があるため、配列[{date, items}] に正規化する
  if (Array.isArray(by_date)) {
    // 既に [{date, items}] 形式想定
    return by_date
      .map((d) => {
        if (d && typeof d === 'object' && 'date' in d) return d;
        if (typeof d === 'string') return { date: d, items: [] };
        return d;
      })
      .filter(Boolean);
  }
  if (by_date && typeof by_date === 'object') {
    // { "YYYY-MM-DD": {items:[...]}, ... } あるいは { "YYYY-MM-DD": [...] }
    return Object.entries(by_date).map(([date, v]) => {
      const items = Array.isArray(v?.items) ? v.items : Array.isArray(v) ? v : [];
      return { date, items };
    });
  }
  return [];
}
async function run() {
  const args = parseArgs(process.argv);
  const raw = await fs.readFile(args.in, 'utf8');
  const json = JSON.parse(raw);
  const by = normalizeByDate(json.by_date);

  // プール作成（全期間から抽出）
  const pool = [];
  for (const d of by) {
    for (const it of d.items || []) {
      if (it?.answers?.canonical) pool.push(it);
    }
  }

  const target = by.find(d => String(d.date) === String(args.date));
  if (!target) {
    console.warn(`[warn] by_date has no ${args.date}; nothing to do.`);
  } else {
    let touched = 0;
    for (const item of target.items || []) {
      const correct = item?.answers?.canonical;
      if (!correct) continue;

      const hasChoices = Array.isArray(item.choices) && item.choices.includes(correct) && item.choices.length >= 4;
      if (hasChoices && !args.force) continue;

      const ds = pickDistractors(item, pool, 3);
      const choices = [correct, ...ds];
      // シャッフル（安易に決め打ち順にならないよう）
      for (let i = choices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [choices[i], choices[j]] = [choices[j], choices[i]];
      }
      item.choices = uniq(choices).slice(0, 4);
      // 念のため正解が含まれているか再確認
      if (!item.choices.includes(correct)) {
        item.choices[0] = correct;
      }
      touched++;
    }
    console.log(`[distractors] date=${args.date} items=${target.items?.length ?? 0} updated=${touched}`);
  }

  const outPath = args.out || args.in;
  await fs.writeFile(outPath, JSON.stringify(json, null, 2), 'utf8');
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
