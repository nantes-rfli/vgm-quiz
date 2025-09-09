#!/usr/bin/env node
/**
 * Verify provenance_fallbacks_v1.mjs is idempotent for a given JSON file.
 * Usage: node scripts/tests/provenance_fallback_idempotency.mjs --json <path>
 * Runs provenance_fallbacks_v1.mjs again and fails if it mutates the file.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const idx = args.indexOf('--json');
const json = idx >= 0 ? args[idx + 1] : null;
if (!json) {
  console.error('Usage: node scripts/tests/provenance_fallback_idempotency.mjs --json <path>');
  process.exit(2);
}

const before = readFileSync(json, 'utf8');
// Run provenance_fallbacks_v1.mjs again on the same file
spawnSync(process.execPath, ['scripts/provenance_fallbacks_v1.mjs', '--json', json], { stdio: 'inherit' });
const after = readFileSync(json, 'utf8');

if (before !== after) {
  // revert file to original state so subsequent steps are not affected
  writeFileSync(json, before, 'utf8');
  console.error('::error::provenance_fallbacks_v1.mjs produced changes on re-run (not idempotent)');
  process.exit(1);
}
console.log('provenance fallback idempotency: OK');
