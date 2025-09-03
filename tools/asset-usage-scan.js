#!/usr/bin/env node
/**
 * Asset usage scanner (best-effort, static grep).
 * - Scans public/* for asset files
 * - Greps repo text files for references to those paths
 * - Prints a report of potentially unused assets
 *
 * Usage: node tools/asset-usage-scan.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const PUBLIC = path.join(ROOT, 'public');

/** file extensions considered "assets" */
const ASSET_EXT = new Set([
  '.png','.jpg','.jpeg','.gif','.webp','.svg','.ico',
  '.mp3','.wav','.m4a','.mp4','.webm',
  '.woff','.woff2','.ttf','.otf'
]);

/** directories to skip entirely */
const SKIP_DIRS = new Set(['.git', 'node_modules', '.github', 'e2e']);
/** text-like extensions we will search through */
const TEXT_EXT = new Set(['.html','.htm','.css','.js','.mjs','.json','.md','.yml','.yaml','.txt']);

/** whitelist patterns (regex) that mark assets as implicitly used (e.g., SW cache patterns) */
const WHITELIST_REGEX = [
  /\/ogp\/daily-\d{4}-\d{2}-\d{2}\.png/,
  /\/app\/icons\/app-icon\.svg/,
];

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(p);
    } else {
      yield p;
    }
  }
}

function isTextFile(p) {
  const ext = path.extname(p).toLowerCase();
  return TEXT_EXT.has(ext);
}
function isAssetFile(p) {
  const ext = path.extname(p).toLowerCase();
  return ASSET_EXT.has(ext);
}

function rel(p) {
  return p.replace(ROOT, '').replace(/^[\\/]/, '').replace(/\\/g, '/');
}

function collectAssets() {
  const assets = [];
  for (const p of walk(PUBLIC)) {
    if (isAssetFile(p)) assets.append ? assets.append(rel(p)) : assets.push(rel(p));
  }
  return assets;
}

function* iterTextFiles() {
  for (const p of walk(ROOT)) {
    if (p.startsWith(PUBLIC)) continue; // don't scan binary assets themselves
    if (isTextFile(p)) yield p;
  }
}

function searchRefs(assets) {
  const refMap = new Map(assets.map(a => [a, 0]));
  const texts = Array.from(iterTextFiles());
  for (const file of texts) {
    let text;
    try {
      text = fs.readFileSync(file, 'utf8');
    } catch { continue; }
    for (const a of assets) {
      if (text.includes(a) || text.includes('/' + a) || text.includes(a.replace(/^public\//, ''))) {
        refMap.set(a, (refMap.get(a) || 0) + 1);
      }
    }
  }
  // whitelist
  for (const a of assets) {
    for (const re of WHITELIST_REGEX) {
      if (re.test('/' + a)) {
        refMap.set(a, (refMap.get(a) || 0) + 1);
        break;
      }
    }
  }
  return refMap;
}

function main() {
  if (!fs.existsSync(PUBLIC)) {
    console.error('public/ not found. Run from repo root.');
    process.exit(1);
  }
  const assets = collectAssets();
  const refMap = searchRefs(assets);
  const unused = assets.filter(a => (refMap.get(a) || 0) === 0);
  console.log('# Asset usage scan');
  console.log(`Assets scanned: ${assets.length}`);
  console.log(`Potentially unused: ${unused.length}`);
  if (unused.length) {
    console.log('\n## Candidates to review (no references found):');
    unused.sort().forEach(a => console.log('-', a));
  } else {
    console.log('\nNo unused assets detected.');
  }
  process.exit(0);
}

if (require.main === module) main();

