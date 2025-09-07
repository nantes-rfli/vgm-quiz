#!/usr/bin/env node
/**
 * scripts/normalize_core_guard_cli.mjs
 * - 入力JSONを読み込み、`by_date` マップが検出された場合は **ノーオペ** で終了（安全弁）。
 * - 単一アイテム形の場合のみ `normalize_core.mjs` を用いて正規化して上書き保存。
 *
 * 使い方:
 *   node scripts/normalize_core_guard_cli.mjs --in build/daily_today.json --out build/daily_today.json
 */
import { readFile, writeFile } from 'node:fs/promises';
import { normalizeContainer } from './normalize_core.mjs';

function hasByDateMap(obj) {
  if (!obj || typeof obj !== 'object') return false;
  const m = obj.by_date;
  if (!m || typeof m !== 'object') return false;
  return Object.keys(m).length > 0;
}

function parseArgs(argv) {
  const args = { in: '', out: '' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--in') args.in = argv[++i];
    else if (a === '--out') args.out = argv[++i];
  }
  if (!args.in) throw new Error('--in is required');
  if (!args.out) args.out = args.in;
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const input = JSON.parse(await readFile(args.in, 'utf-8'));
  if (hasByDateMap(input)) {
    console.error('[normalize_core_guard] detected by_date container; NO-OP:', args.in);
    return;
  }
  const outObj = normalizeContainer(input);
  await writeFile(args.out, JSON.stringify(outObj, null, 2) + '\n', 'utf-8');
  console.error('[normalize_core_guard] normalized ->', args.out);
}

main().catch(e => { console.error(e); process.exit(1); });
