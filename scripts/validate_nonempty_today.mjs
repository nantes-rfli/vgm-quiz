#!/usr/bin/env node
/**
 * validate_nonempty_today.mjs
 * daily_auto.json の最新日（または --date 指定日）に items が 1 件以上あることを検証する。
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

async function run() {
  const args = parseArgs(process.argv);
  const raw = await fs.readFile(args.in, 'utf8');
  const json = JSON.parse(raw);
  const by = normalizeByDate(json.by_date);
  if (!by.length) {
    console.error('[validate_nonempty_today] by_date is empty');
    process.exit(1);
  }
  const dates = by.map(d => d.date).sort();
  const targetDate = args.date || dates[dates.length - 1];
  const target = by.find(d => String(d.date) === String(targetDate));
  const n = target?.items?.length || 0;
  if (n < 1) {
    console.error(`[validate_nonempty_today] date=${targetDate} has no items`);
    process.exit(1);
  }
  console.log(`[validate_nonempty_today] date=${targetDate} items=${n} OK`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

