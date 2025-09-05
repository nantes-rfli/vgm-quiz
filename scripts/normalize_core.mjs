/**
 * normalize_core.mjs — v1.8 unified normalization helpers
 * NOTE: Not yet wired; safe to import incrementally.
 */

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
import { readFile } from 'fs/promises';
import path from 'path';
import url from 'url';
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

export async function loadAliases(kind /* 'game' | 'composer' | 'track' */) {
  const p = path.resolve(__dirname, `../data/aliases/${kind}.json`);
  try {
    const raw = await readFile(p, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
