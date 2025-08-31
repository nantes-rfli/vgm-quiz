#!/usr/bin/env node
'use strict';
/**
 * Compare Node-side normalize (scripts/pipeline/normalize.js) with
 * browser-side normalize (public/app/normalize.mjs).
 * Exits non-zero if mismatches exist. Writes a short summary when run in GitHub Actions.
 */
const fs = require('fs');
const path = require('path');
const { normalizeAnswer: normalizeNode } = require('./pipeline/normalize');

async function loadBrowserNormalize() {
  const mPath = path.resolve(__dirname, '../public/app/normalize.mjs');
  const mod = await import('file://' + mPath);
  const fn =
    mod.normalizeAnswer ||
    mod.normalize ||
    (mod.default && (mod.default.normalizeAnswer || mod.default.normalize)) ||
    mod.default;
  if (typeof fn !== 'function') {
    throw new Error('normalize.mjs does not export normalize function');
  }
  return fn;
}

function writeSummary(lines) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) return;
  fs.appendFileSync(summaryPath, lines.join('\n') + '\n');
}

async function main() {
  const normalizeBrowser = await loadBrowserNormalize();
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
  ];
  let mismatches = [];
  for (const s of samples) {
    const a = normalizeNode(s);
    const b = normalizeBrowser(s);
    if (a !== b) {
      mismatches.push({ s, node: a, browser: b });
    }
  }
  if (mismatches.length === 0) {
    console.log('PARITY OK: Node normalize matches browser normalize on samples.');
    writeSummary([
      '### normalize parity',
      '- Result: **OK** (Node === Browser)',
      `- Samples: ${samples.length}`,
    ]);
    return;
  } else {
    console.error('PARITY MISMATCHES:');
    for (const m of mismatches) {
      console.error(`- ${m.s}: node="${m.node}" browser="${m.browser}"`);
    }
    writeSummary([
      '### normalize parity',
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

