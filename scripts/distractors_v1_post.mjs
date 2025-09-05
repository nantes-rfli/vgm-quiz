#!/usr/bin/env node
/**
 * distractors_v1_post.mjs
 * daily_auto.json 生成後に、当日分の choices を補完/強化する軽量ポストプロセッサ。
 *
 * 入力:  --in  public/app/daily_auto.json
 *        --date YYYY-MM-DD (JST基準。未指定なら今日)
 * 出力:  上書き保存（--out 指定時は別ファイルへ）
 *
 * 方針（MVP）:
 *  - 正解: item.answers.canonical を採用
 *  - 候補プール: daily_auto.by_date の answers.canonical を横断収集
 *  - スコアリング（高い順に採用）:
 *      +2: 同作曲者（track.composer が一致）
 *      +1: 同シリーズ/同ゲーム（game.series または game.name が部分一致）
 *     +0.5: 年が近い（|year - year'| <= 2）
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

function uniq(arr){ return Array.from(new Set(arr)); }

function pickDistractors(target, pool, k = 3) {
  const canonical = target?.answers?.canonical || target?.answers;
  if (!canonical) return [];
  const base = [];
  const c = norm(target?.track?.composer || target?.composer);
  const s = norm(target?.game?.series || target?.game?.name || target?.game);
  const y = Number(target?.game?.year);
  for (const it of pool) {
    const ci = norm(it?.track?.composer || it?.composer);
    const si = norm(it?.game?.series || it?.game?.name || it?.game);
    const yi = Number(it?.game?.year);
    let score = 0;
    if (ci && c && ci === c) score += 2;
    if (si && s && si === s) score += 1;
    if (Number.isFinite(yi) && Number.isFinite(y) && Math.abs(yi - y) <= 2) score += 0.5;
    base.push([score, it?.answers?.canonical, it]);
  }
  base.sort((a,b)=>b[0]-a[0]);
  const picked = base.map(e=>e[1]).filter(x=>x && x!==canonical);
  return uniq(picked).slice(0, k);
}

function getEntries(by_date){
  // Normalize by_date into array of {date, entry}
  if (Array.isArray(by_date)){
    // Accept [{date, items:[...] }] or [{date, ...flat...}]
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
async function run() {
  const args = parseArgs(process.argv);
  const raw = await fs.readFile(args.in, 'utf8');
  const json = JSON.parse(raw);
  const entries = getEntries(json.by_date);

  // プール作成（全期間から抽出）
  const pool = [];
  for (const d of entries) {
    const it = d.entry;
    if (it?.answers?.canonical || it?.answers) pool.push(it);
  }

  const target = entries.find(d => String(d.date) === String(args.date));
  if (!target) {
    console.warn(`[warn] by_date has no ${args.date}; nothing to do.`);
  } else {
    const item = target.entry || {};
    const correct = item?.answers?.canonical || item?.answers;
    const ch = Array.isArray(item?.choices) ? item.choices : [];
    const haveCorrect = correct && ch.includes(correct);
    if (!haveCorrect || ch.length < 4) {
      const need = Math.max(0, 4 - ch.length - (haveCorrect ? 0 : 1));
      const picks = pickDistractors(item, pool, need + (haveCorrect ? 0 : 1));
      const merged = haveCorrect ? ch.concat(picks).slice(0,4) : [correct, ...picks].slice(0,4);
      item.choices = uniq(merged);
      console.log(`[distractors] date=${args.date} updated choices -> ${JSON.stringify(item.choices)}`);
    }
    // write back in flat shape under by_date
    if (json.by_date && typeof json.by_date === 'object' && !Array.isArray(json.by_date)){
      json.by_date[String(args.date)] = item;
    } else {
      // convert to object
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
