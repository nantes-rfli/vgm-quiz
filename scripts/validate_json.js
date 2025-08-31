/* Lightweight JSON validations for vgm-quiz.
 * Fails fast on structural breakage; permissive on optional fields.
 *
 * Checks:
 *  - public/app/daily.json: has .map object with date keys YYYY-MM-DD
 *      and values {title:string, type:string in allowed}
 *  - public/build/aliases.json (if exists): object<string, string[]>
 *  - public/app/aliases_local.json (if exists): object<string, string|string[]>
 *  - public/build/dataset.json (if exists): array; spot-check items have title/game/composer strings
 */

const fs = require('fs');
const path = require('path');

function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function assert(cond, msg) {
  if (!cond) {
    throw new Error(msg);
  }
}

function exists(p) {
  return fs.existsSync(p);
}

function checkDailyJSON(root) {
  const p = path.join(root, 'public', 'app', 'daily.json');
  assert(exists(p), `missing file: ${p}`);
  const obj = readJSON(p);
  assert(obj && typeof obj === 'object' && !Array.isArray(obj), 'daily.json must be an object');
  const m = obj.map;
  assert(m && typeof m === 'object' && !Array.isArray(m), 'daily.json.map must be an object map');
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  const allowedTypes = new Set(['title→game', 'game→composer', 'title→composer']);
  let count = 0;
  for (const [k, v] of Object.entries(m)) {
    assert(dateRe.test(k), `daily.map key not a date (YYYY-MM-DD): ${k}`);
    assert(v && typeof v === 'object', `daily.map[${k}] must be an object`);
    assert(typeof v.title === 'string' && v.title.length > 0, `daily.map[${k}].title must be non-empty string`);
    if (typeof v.type !== 'undefined') {
      assert(typeof v.type === 'string', `daily.map[${k}].type must be string`);
      assert(allowedTypes.has(v.type), `daily.map[${k}].type must be one of ${[...allowedTypes].join(', ')}`);
    }
    count++;
  }
  assert(count > 0, 'daily.json.map must have at least one entry');
  console.log(`[validate] daily.json OK (${count} entries)`);
}

function checkAliasesJSON(p) {
  if (!exists(p)) {
    console.log(`[validate] skip (not found): ${p}`);
    return;
  }
  const m = readJSON(p);
  assert(m && typeof m === 'object' && !Array.isArray(m), `${p} must be an object`);
  let n = 0;
  for (const [k, arr] of Object.entries(m)) {
    assert(typeof k === 'string' && k.length > 0, `${p} key must be string`);
    if (Array.isArray(arr)) {
      for (const s of arr) {
        assert(typeof s === 'string', `${p}[${k}] array must contain strings`);
      }
    } else {
      assert(typeof arr === 'string', `${p}[${k}] must be string or array of strings`);
    }
    n++;
  }
  console.log(`[validate] ${path.basename(p)} OK (${n} keys)`);
}

function spotCheckDataset(p) {
  if (!exists(p)) {
    console.log(`[validate] skip (not found): ${p}`);
    return;
  }
  const arr = readJSON(p);
  assert(Array.isArray(arr), 'dataset.json must be an array');
  const size = arr.length;
  assert(size > 0, 'dataset.json must not be empty');
  const samples = [arr[0], arr[Math.floor(size / 2)], arr[size - 1]].filter(Boolean);
  for (const item of samples) {
    assert(item && typeof item === 'object', 'dataset item must be an object');
    for (const key of ['title', 'game', 'composer']) {
      assert(typeof item[key] === 'string' && item[key].length > 0, `dataset item missing string field: ${key}`);
    }
  }
  console.log(`[validate] dataset.json OK (spot-checked ${samples.length}/${size})`);
}

function main() {
  const root = path.join(__dirname, '..');
  checkDailyJSON(root);
  checkAliasesJSON(path.join(root, 'public', 'build', 'aliases.json'));
  checkAliasesJSON(path.join(root, 'public', 'app', 'aliases_local.json'));
  spotCheckDataset(path.join(root, 'public', 'build', 'dataset.json'));
  console.log('[validate] all checks passed');
}

main();

