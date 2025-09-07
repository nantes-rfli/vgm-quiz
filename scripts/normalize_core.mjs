#!/usr/bin/env node
/**
 * normalize_core.mjs — v1.8 unified normalization helpers
 * NOTE: Not yet wired; safe to import incrementally.
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';
import url from 'url';
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

// Wave dash variants to full-width tilde U+301C or ASCII hyphen?
// Here, normalize to ASCII hyphen-minus and collapse repeats.
export function normalizeDashes(s) {
  if (!s) return s;
  return String(s)
    // common tilde/dash variants
    .replace(/[\u301C\u3030\u30FC\uFF5E\u2212\u2010-\u2015]/g, '-')
    // collapse multiple dashes
    .replace(/-+/g, '-');
}

// Remove CJK-internal spaces but keep ASCII word boundaries
export function normalizeCjkSpaces(s) {
  if (!s) return s;
  // Remove spaces between two CJK chars
  return String(s).replace(/([\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}])\s+([\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}])/gu, '$1$2');
}

// Roman numerals: unify I,V,X,L,C,D,M blocks; add thin space before them when trailing a word
export function normalizeRomanNumerals(s) {
  if (!s) return s;
  // uppercase roman
  const ROMAN = '(?=[IVXLCDM])(I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII|XIII|XIV|XV|XVI|XVII|XVIII|XIX|XX)';
  return String(s)
    .replace(/Ｉ/g, 'I')
    .replace(new RegExp(`([^\\s])(${ROMAN})`, 'g'), '$1 $2')
    .replace(/\s{2,}/g, ' ');
}

// Long vowel normalization around 'ン' (Japanese)
export function normalizeLongVowelAroundN(s) {
  if (!s) return s;
  return String(s).replace(/ンー/g, 'ン');
}

export function normalizeAll(s) {
  let x = s;
  x = normalizeDashes(x);
  x = normalizeCjkSpaces(x);
  x = normalizeRomanNumerals(x);
  x = normalizeLongVowelAroundN(x);
  return x;
}

// Simple aliases loader (future use)
export async function loadAliases(kind /* 'game' | 'composer' | 'track' */) {
  const p = path.resolve(__dirname, `../data/aliases/${kind}.json`);
  try {
    const raw = await readFile(p, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

// Container normalization (v1.8 Phase 2)
function normLower(s) {
  return String(s || '').toLowerCase().trim().replace(/\s+/g, ' ');
}

function toName(x) {
  return typeof x === 'object' && x ? x.name || '' : x || '';
}

function unwrap(input) {
  if (input && input.date && input.item) return { date: input.date, item: input.item };
  if (input && input.date && !input.item) {
    const { date, ...rest } = input;
    if (Object.keys(rest).length) return { date, item: rest };
  }
  if (input && input.date && Array.isArray(input.items) && input.items.length) {
    return { date: input.date, item: input.items[0] };
  }
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    const keys = Object.keys(input);
    if (keys.length === 1 && /^\d{4}-\d{2}-\d{2}$/.test(keys[0])) {
      return { date: keys[0], item: input[keys[0]] };
    }
  }
  if (Array.isArray(input) && input.length) {
    for (const it of input) {
      const u = unwrap(it);
      if (u) return u;
    }
  }
  if (input && typeof input === 'object') {
    for (const v of Object.values(input)) {
      const u = unwrap(v);
      if (u) return u;
    }
  }
  return null;
}

export function normalizeContainer(input) {
  const unwrapped = unwrap(input);
  if (!unwrapped) throw new Error('could not unwrap input');
  const { date, item: raw } = unwrapped;
  const title = raw?.title || raw?.track?.name || '';
  const game = raw?.game ?? raw?.track?.game ?? '';
  const composer = raw?.composer ?? raw?.track?.composer ?? '';
  const media = raw?.media ?? raw?.clip ?? {};
  const answers = { ...(raw?.answers || {}) };
  if (answers.canonical == null) answers.canonical = game;
  const item = { title, game, composer, media, answers };
  item.norm = {
    title: normLower(item.title),
    game: normLower(toName(item.game)),
    composer: normLower(item.composer),
    answer: normLower(Array.isArray(item.answers?.canonical) ? item.answers.canonical[0] : item.answers?.canonical)
  };
  return { date, item };
}

function parseArgs(argv) {
  const out = { in: null, out: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--in' && argv[i + 1]) {
      out.in = argv[++i];
      continue;
    }
    if (a === '--out' && argv[i + 1]) {
      out.out = argv[++i];
      continue;
    }
  }
  return out;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.in) throw new Error('missing --in <path>');
  const raw = await readFile(opts.in, 'utf-8').catch(() => null);
  if (!raw) throw new Error('input not found: ' + opts.in);
  const json = JSON.parse(raw);
  const outObj = normalizeContainer(json);
  const outPath = opts.out || opts.in;
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, JSON.stringify(outObj, null, 2) + '\n', 'utf-8');
  console.error('[normalize_core] wrote', outPath);
}

if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  main().catch(e => {
    console.error(e);
    process.exit(1);
  });
}
