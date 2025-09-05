#!/usr/bin/env node
/**
 * validate_nonempty_today.mjs
 * daily_auto.json の最新日（または --date 指定日）に「フラット1件」または items[0] が存在することを検証する。
 * 条件を満たさない場合は exit 1。
 */

import fs from 'node:fs/promises';

function parseArgs(argv) {
  const a = { in: 'public/app/daily_auto.json' };
  for (let i = 2; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--in') a.in = argv[++i];
    else if (t === '--date') a.date = argv[++i];
  }
  return a;
}

function getEntries(by_date){
  // return [{date, v}] where v is a flat entry if available; otherwise first item in items[]
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

function hasRequiredFlat(val){
  if (!val || typeof val!=='object') return false;
  const titleOk = !!val.title;
  const gameOk = !!(typeof val.game==='string' ? val.game : val.game?.name);
  const compOk = !!(val.composer || val.track?.composer);
  return titleOk && gameOk && compOk;
}

async function run() {
  const args = parseArgs(process.argv);
  const raw = await fs.readFile(args.in, 'utf8');
  const json = JSON.parse(raw);
  const entries = getEntries(json.by_date);
  if (!entries.length) {
    console.error('[validate_nonempty_today] by_date is empty');
    process.exit(1);
  }
  const dates = entries.map(d => d.date).sort();
  const targetDate = args.date || dates[dates.length - 1];
  const target = entries.find(d => String(d.date) === String(targetDate));
  if (!hasRequiredFlat(target?.v)) {
    console.error(`[validate_nonempty_today] date=${targetDate} missing flat/item[0] required fields`);
    process.exit(1);
  }
  console.log(`[validate_nonempty_today] date=${targetDate} entry OK`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

