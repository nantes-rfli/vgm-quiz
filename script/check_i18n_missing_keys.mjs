/* Simple missing-keys checker for i18n
 * Scans code for t('...') / t("...") usage and verifies that keys exist
 * in locales/en.json and locales/ja.json. Fails on first missing key.
 */

/* eslint-disable no-console */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const APP_DIR = path.join(ROOT, 'public', 'app');
const LOCALES_DIR = path.join(APP_DIR, 'locales');

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(p, out);
    } else {
      out.push(p);
    }
  }
  return out;
}

function scanKeysFromFile(fp) {
  const src = fs.readFileSync(fp, 'utf8');
  const re = /\bt\((['"])([^'"\n]+)\1\)/g;
  const keys = [];
  let m;
  while ((m = re.exec(src))) {
    keys.push(m[2]);
  }
  return keys;
}

function readJson(fp) {
  return JSON.parse(fs.readFileSync(fp, 'utf8'));
}

function hasKey(obj, dotted) {
  return dotted
    .split('.')
    .reduce((acc, k) => (acc && acc[k] != null ? acc[k] : undefined), obj) != null;
}

function main() {
  const files = walk(APP_DIR).filter((f) => /\.(m?js)$/.test(f));
  const allKeys = new Set();
  for (const f of files) {
    if (f.includes('/locales/')) continue; // skip locale json imports inside code dir
    scanKeysFromFile(f).forEach((k) => allKeys.add(k));
  }
  const en = readJson(path.join(LOCALES_DIR, 'en.json'));
  const ja = readJson(path.join(LOCALES_DIR, 'ja.json'));

  let missing = 0;
  for (const k of allKeys) {
    const okEn = hasKey(en, k);
    const okJa = hasKey(ja, k);
    if (!okEn || !okJa) {
      console.error(`✗ Missing key "${k}" in: ${!okEn ? 'en ' : ''}${!okJa ? 'ja' : ''}`.trim());
      missing++;
    }
  }
  if (missing > 0) {
    console.error(`Found ${missing} missing i18n key(s).`);
    process.exit(1);
  }
  console.log(`✓ i18n keys OK (${allKeys.size} referenced)`);
}

main();

