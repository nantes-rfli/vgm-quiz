#!/usr/bin/env node
/**
 * v1.8 soft schema check (no external deps)
 * - Validates shape of a single daily item (today) using lightweight checks.
 * - Sources: prefer build/daily_today.json; fallback to public/app/daily_auto.json
 * - Exit 0 by default (soft). Set SCHEMA_CHECK_STRICT=true to exit 1 on violations.
 */
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import url from 'url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

const candidates = [
  path.resolve(__dirname, '../build/daily_today.json'),
  path.resolve(__dirname, '../public/app/daily_auto.json')
];

function pickSource() {
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return null;
}

function isNonEmptyString(x) {
  return typeof x === 'string' && x.trim().length > 0;
}

function isStringArray(arr) {
  return Array.isArray(arr) && arr.every(isNonEmptyString);
}

function annotate(msg) {
  // GitHub Actions annotation compatible line
  console.log(`::warning::schema ${msg}`);
}

async function main() {
  const strict = (process.env.SCHEMA_CHECK_STRICT || 'false').toLowerCase() === 'true';
  const src = pickSource();
  if (!src) {
    annotate('no source found (build/daily_today.json nor public/app/daily_auto.json)');
    process.exit(strict ? 1 : 0);
  }
  const raw = await readFile(src, 'utf-8');
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    annotate(`invalid JSON: ${e.message}`);
    process.exit(strict ? 1 : 0);
  }

  // Some builds may wrap the item (e.g., { by_date: { "YYYY-MM-DD": {...} } })
  if (data && data.by_date && typeof data.by_date === 'object') {
    const keys = Object.keys(data.by_date);
    if (keys.length === 1) {
      data = { date: keys[0], ...data.by_date[keys[0]] };
    }
  }

  const errors = [];
  // Required top-level
  if (!isNonEmptyString(data.title)) errors.push('title missing/non-string');
  if (!isNonEmptyString(data.game)) errors.push('game missing/non-string');
  if (!(data.track && isNonEmptyString(data.track.composer))) errors.push('track.composer missing/non-string');
  if (!(data.media && isNonEmptyString(data.media.provider) && isNonEmptyString(data.media.id))) errors.push('media.provider/id missing/non-string');
  if (!(data.answers && isStringArray(data.answers.canonical) && data.answers.canonical.length > 0)) errors.push('answers.canonical missing/empty');

  // Optional but recommended
  if (typeof data.difficulty !== 'number' || data.difficulty < 0 || data.difficulty > 1) {
    errors.push('difficulty missing or out of range [0,1]');
  }

  // choices integrity (if present)
  if (Array.isArray(data.choices)) {
    const uniq = new Set(data.choices.map(String));
    if (uniq.size !== data.choices.length) errors.push('choices contain duplicates');
  }

  if (errors.length) {
    errors.forEach(e => annotate(e));
    console.log(`schema: violations=${errors.length} file=${src}`);
    process.exit(strict ? 1 : 0);
  } else {
    console.log(`schema: OK file=${src}`);
    process.exit(0);
  }
}

main().catch(e => {
  annotate(`unhandled error: ${e?.stack || e}`);
  process.exit(1);
});
