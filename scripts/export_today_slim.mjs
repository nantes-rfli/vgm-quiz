#!/usr/bin/env node
/**
 * export_today_slim.mjs
 * `public/app/daily_auto.json` から対象日（最新 or --date 指定）の1件を抽出し、
 * 検収しやすい **スリムなアーティファクト** を出力します。
 *
 * 出力:
 *   --out-json  build/daily_today.json  （{ date, item }）
 *   --out-md    build/daily_today.md    （人間読みサマリ）
 */

import fs from 'node:fs/promises';
import fss from 'node:fs';
import path from 'node:path';

function parseArgs(argv){
  const a = { inp: 'public/app/daily_auto.json', date: null, outJson: 'build/daily_today.json', outMd: 'build/daily_today.md' };
  for (let i=2;i<argv.length;i++){
    const t = argv[i];
    if (t==='--in') a.inp = argv[++i];
    else if (t==='--date') a.date = argv[++i];
    else if (t==='--out-json') a.outJson = argv[++i];
    else if (t==='--out-md') a.outMd = argv[++i];
  }
  return a;
}

function todayJST(){
  const now = new Date();
  const tz = 'Asia/Tokyo';
  const z = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year:'numeric', month:'2-digit', day:'2-digit' })
    .formatToParts(now).reduce((o,p)=>(o[p.type]=p.value,o),{});
  return `${z.year}-${z.month}-${z.day}`;
}

function toEntries(by_date){
  if (Array.isArray(by_date)){
    return by_date.map(d=>{
      if (d && typeof d==='object' && 'date' in d){
        const flat = (d && typeof d==='object' && !Array.isArray(d.items)) ? d : null;
        const v = flat && !Array.isArray(flat.items) ? flat : (Array.isArray(d.items) ? d.items[0] : d);
        return { date: d.date, v };
      }
      return null;
    }).filter(Boolean);
  }
  if (by_date && typeof by_date==='object'){
    return Object.entries(by_date).map(([date, v])=>{
      const flat = v && typeof v==='object' && !Array.isArray(v.items) ? v : null;
      const val = flat || (Array.isArray(v?.items) ? v.items[0] : v);
      return { date, v: val };
    });
  }
  return [];
}

function ensureDir(p){
  const dir = path.dirname(p);
  if (!fss.existsSync(dir)) fss.mkdirSync(dir, { recursive: true });
}

function mdSummary(date, it){
  const lines = [];
  lines.push(`# Daily (Slim) — ${date}`);
  lines.push('');
  lines.push(`- **Title**: ${it?.title ?? '—'}`);
  lines.push(`- **Game**: ${typeof it?.game==='string' ? it?.game : (it?.game?.name ?? '—')}`);
  lines.push(`- **Composer**: ${it?.composer ?? it?.track?.composer ?? '—'}`);
  const m = it?.media;
  lines.push(`- **Media**: ${m ? `${m.provider}:${m.id}` : '—'}`);
  const ans = it?.answers?.canonical;
  const ch = Array.isArray(it?.choices) ? it.choices.length : 0;
  lines.push(`- **Answer**: ${ans ?? '—'}  /  **Choices**: ${ch}`);
  if (typeof it?.difficulty === 'number') lines.push(`- **Difficulty**: ${it.difficulty.toFixed(2)}`);
  return lines.join('\n');
}

async function run(){
  const args = parseArgs(process.argv);
  const raw = await fs.readFile(args.inp, 'utf-8');
  const json = JSON.parse(raw);
  const entries = toEntries(json.by_date);
  if (!entries.length){
    console.warn('[export_today_slim] by_date empty; nothing to export.');
    return;
  }
  const dates = entries.map(e=>e.date).sort();
  const date = args.date || dates[dates.length-1] || todayJST();
  const target = entries.find(e => String(e.date) === String(date)) || entries[entries.length-1];
  const item = target?.v || null;

  ensureDir(args.outJson);
  ensureDir(args.outMd);
  await fs.writeFile(args.outJson, JSON.stringify({ date, item }, null, 2), 'utf-8');
  await fs.writeFile(args.outMd, mdSummary(date, item), 'utf-8');
  console.log(`[export_today_slim] wrote ${args.outJson} and ${args.outMd} for date=${date}`);
}

run().catch(e=>{
  console.error(e);
  process.exit(1);
});
