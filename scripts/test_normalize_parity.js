#!/usr/bin/env node
'use strict';
/**
 * Compare Node-side normalize (scripts/pipeline/normalize.js) with
 * browser-side normalize (public/app/normalize.mjs) **as used in compare-key**.
 * We post-process the browser output into a compare key (fold diacritics, collapse
 * spaces/punctuations, roman tokens→arabic) so that both sides represent the same
 * matching behavior.
 * Exits non-zero if mismatches exist. Writes a short summary when run in GitHub Actions.
 */
const fs = require('fs');
const path = require('path');
const { normalizeAnswer: normalizeNode } = require('./pipeline/normalize');

async function loadBrowserNormalize() {
  const mPath = path.resolve(__dirname, '../public/app/normalize.mjs');
  const mod = await import('file://' + mPath);
  // pick function by common names or heuristics
  const candidates = [];
  if (typeof mod.normalizeAnswer === 'function') candidates.push(mod.normalizeAnswer);
  if (typeof mod.normalize === 'function') candidates.push(mod.normalize);
  if (typeof mod.default === 'function') candidates.push(mod.default);
  if (mod.default && typeof mod.default.normalizeAnswer === 'function') candidates.push(mod.default.normalizeAnswer);
  if (mod.default && typeof mod.default.normalize === 'function') candidates.push(mod.default.normalize);
  // last resort: search any function with "normalize" in key
  for (const [k, v] of Object.entries(mod)) {
    if (typeof v === 'function' && /normalize/i.test(k)) candidates.push(v);
  }
  if (mod.default && typeof mod.default === 'object') {
    for (const [k, v] of Object.entries(mod.default)) {
      if (typeof v === 'function' && /normalize/i.test(k)) candidates.push(v);
    }
  }
  const fn = candidates[0];
  if (typeof fn !== 'function') {
    const keys = Object.keys(mod).concat(mod.default && typeof mod.default === 'object' ? Object.keys(mod.default) : []);
    const err = new Error('normalize.mjs does not export a normalize function');
    err.exportedKeys = keys;
    throw err;
  }
  return fn;
}

function writeSummary(lines) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) return;
  fs.appendFileSync(summaryPath, lines.join('\n') + '\n');
}

// --- compare-key post processing (browser output → compare key) ---
const ROMAN_ENTRIES = [
  ["xx",20],["xix",19],["xviii",18],["xvii",17],["xvi",16],["xv",15],["xiv",14],["xiii",13],["xii",12],["xi",11],
  ["x",10],["ix",9],["viii",8],["vii",7],["vi",6],["v",5],["iv",4],["iii",3],["ii",2],["i",1]
];
const ROMAN_MAP = new Map(ROMAN_ENTRIES);
const ROMAN_TOKEN_RE = new RegExp("\\b(?:" + ROMAN_ENTRIES.map(([r]) => r).join("|") + ")\\b", "g");
function toNFKC(s){ return s.normalize ? s.normalize('NFKC') : s; }
function stripDiacritics(s){ return s.normalize('NFD').replace(/[\u0300-\u036f]/g,''); }
function romanTokensOnly(s){ return s.replace(ROMAN_TOKEN_RE, m => String(ROMAN_MAP.get(m))); }
function collapse(s){ return s.replace(/[\p{P}\p{S}\s\u30FC\-]/gu,''); }
function toCompareKeyFromBrowserOutput(s){
  let t = toNFKC(String(s)).toLowerCase();
  t = t.replace(/&/g,' and ');
  t = stripDiacritics(t);
  t = romanTokensOnly(t);
  t = collapse(t);
  return t;
}

async function main() {
  const normalizeBrowser = await loadBrowserNormalize().catch(err => { console.error(err.message); if (err.exportedKeys) console.error('exported keys:', err.exportedKeys.join(', ')); throw err; });
  const samples = [
    'Megalovania',
    'Toby Fox',
    'Final Fantasy X',
    'Street Fighter II',
    'Rockman X2',
    'Chrono Trigger',
    'ゼルダの伝説',
    'Pokémon Red & Blue',
    'NieR:Automata',
    'Castlevania IV',
    'Ｆｉｎａｌ Ｆａｎｔａｓｙ VII',
    'ポケットモンスター\u3000青',
    'ドラゴン・クエストIII',
    'Street Fighter II Turbo',
    'Castlevania ＆ Dracula X',
    'chrono〜trigger',
    'RockyIV',
    'Metal Gear Solid — Peace Walker',
    'Kingdom Hearts 358/2 Days'
  ];
  let mismatches = [];
  for (const s of samples) {
    const nodeKey = normalizeNode(s); // already compare key style
    const browserRaw = normalizeBrowser(s); // display-ish
    const browserKey = toCompareKeyFromBrowserOutput(browserRaw);
    if (nodeKey !== browserKey) {
      mismatches.push({ s, node: nodeKey, browser: browserKey });
    }
  }
  if (mismatches.length === 0) {
    console.log('PARITY OK: Node compare key === Browser compare key (post-processed) on samples.');
    writeSummary([
      '### normalize parity (compare-key) ✅',
      '- Result: **OK** (Node === Browser)',
      `- Samples: ${samples.length}`,
    ]);
    return;
  } else {
    console.error('PARITY MISMATCHES (compare-key):');
    for (const m of mismatches) {
      console.error(`- ${m.s}: node="${m.node}" browser="${m.browser}"`);
    }
    writeSummary([
      '### normalize parity (compare-key) ❌',
      '- Result: **MISMATCH**',
      `- Count: ${mismatches.length} / ${samples.length}`,
      '',
      '#### Examples',
      ...mismatches.slice(0, 5).map(m => `- ${m.s}: node=\`${m.node}\`, browser=\`${m.browser}\``)
    ]);
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(2);
});

