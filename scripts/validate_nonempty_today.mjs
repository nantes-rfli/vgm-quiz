#!/usr/bin/env node
/**
 * validate_nonempty_today.mjs
 * daily_auto.json の最新日（または --date 指定日）に **フラットな1件**が存在することを検証する。
 * 0 件の場合は exit 1。
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

function hasRequiredFlat(v){
  return v && typeof v==='object' && v.title && (v.game?.name || typeof v.game==='string') && (v.track?.composer || v.composer);
}

async function run() {
  const args = parseArgs(process.argv);
  const raw = await fs.readFile(args.in, 'utf8');
  const json = JSON.parse(raw);
  const entries = (json.by_date && typeof json.by_date==='object' && !Array.isArray(json.by_date))
    ? Object.entries(json.by_date).map(([date,v])=>({date, v}))
    : [];
  if (!entries.length) {
    console.error('[validate_nonempty_today] by_date is empty');
    process.exit(1);
  }
  const dates = entries.map(d => d.date).sort();
  const targetDate = args.date || dates[dates.length - 1];
  const target = entries.find(d => String(d.date) === String(targetDate));
  if (!hasRequiredFlat(target?.v)) {
    console.error(`[validate_nonempty_today] date=${targetDate} missing required flat entry`);
    process.exit(1);
  }
  console.log(`[validate_nonempty_today] date=${targetDate} flat entry OK`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

