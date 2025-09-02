/* Lightweight JSON validations for vgm-quiz.
 * Fails fast on structural breakage; permissive on optional fields.
 *
 * Checks:
 *  - public/app/daily.json: has .map object with date keys YYYY-MM-DD
 *      and values {title:string, type:string in allowed}
 *  - public/build/aliases.json (if exists): object<string, string[]>
 *  - public/app/aliases_local.json (if exists): object<string, string|string[]>
 *  - public/build/dataset.json (if exists): array or object with `tracks` array; spot-check items have title/game/composer strings
 */

const fs = require('fs');
const path = require('path');
let allAliases = {};
function warnAliasTargetExistence(allAliases, datasetTitles) {
  const exists = new Set(datasetTitles.map(t => String(t).toLowerCase()));
  const issues = [];
  for (const [canon, alist] of Object.entries(allAliases)) {
    if (!exists.has(String(canon).toLowerCase())) {
      issues.push(`  - Canonical not found in dataset: "${canon}"`);
    }
  }
  if (issues.length) {
    console.warn(`[validate] alias referential integrity (non-blocking):\n` + issues.join('\n'));
    if (process.env.ALIAS_STRICT === '1') {
      throw new Error(`alias referential integrity failed: ${issues.length} issue(s)`);
    }
  }
}

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

function checkAliasesCollisionsObject(o, label) {
  if (!o) {
    console.log(`[validate] skip collisions (${label})`);
    return true;
  }
  let ok = true;
  const targets = Array.isArray(o) || typeof o !== 'object' ? { top: o } : o;
  for (const [cat, m] of Object.entries(targets)) {
    if (!m || typeof m !== 'object') continue;
    const seen = new Map();
    for (const [k, v0] of Object.entries(m)) {
      const vals = Array.isArray(v0) ? v0 : [v0];
      for (const v of vals) {
        if (typeof v !== 'string') continue;
        const prev = seen.get(v);
        if (prev && prev !== k) {
          console.error(`[validate] alias collision in ${label}/${cat}: "${v}" -> ${prev} / ${k}`);
          ok = false;
        } else {
          seen.set(v, k);
        }
      }
    }
  }
  if (ok) {
    console.log(`[validate] ${label} collision check OK`);
  }
  return ok;
}

function spotCheckDataset(p) {
  if (!exists(p)) {
    console.log(`[validate] skip (not found): ${p}`);
    return;
  }
  const data = readJSON(p);
  const arr = Array.isArray(data?.tracks) ? data.tracks : (Array.isArray(data) ? data : null);
  assert(Array.isArray(arr), 'dataset.json must be an array or object with tracks array');
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

function checkDatasetDuplicates(ds) {
  if (!ds) {
    console.log('[validate] skip dataset duplicate check');
    return true;
  }
  const arr = Array.isArray(ds?.tracks) ? ds.tracks : (Array.isArray(ds) ? ds : null);
  if (!Array.isArray(arr)) {
    console.log('[validate] skip dataset duplicate check');
    return true;
  }
  const seen = new Set();
  let ok = true;
  for (const t of arr) {
    const id = t && t['track/id'];
    if (typeof id !== 'string') continue;
    if (seen.has(id)) {
      console.error(`[validate] duplicate track/id: ${id}`);
      ok = false;
    } else {
      seen.add(id);
    }
  }
  if (ok) {
    console.log(`[validate] dataset duplicates OK (${seen.size} ids)`);
  }
  return ok;
}

function main() {
  const root = path.join(__dirname, '..');
  checkDailyJSON(root);
  const a1 = (function(){ try { return readJSON(path.join(root, 'public', 'build', 'aliases.json')); } catch (_) { return null; } })();
  const a2 = (function(){ try { return readJSON(path.join(root, 'public', 'app', 'aliases_local.json')); } catch (_) { return null; } })();
  const ds = (function(){ try { return readJSON(path.join(root, 'public', 'build', 'dataset.json')); } catch (_) { return null; } })();
  allAliases = Object.assign({}, a1 || {}, a2 || {});
  checkAliasesJSON(path.join(root, 'public', 'build', 'aliases.json'));
  checkAliasesJSON(path.join(root, 'public', 'app', 'aliases_local.json'));
  spotCheckDataset(path.join(root, 'public', 'build', 'dataset.json'));
  const okExtra = (
    checkAliasesCollisionsObject(a1, 'aliases.json') &&
    checkAliasesCollisionsObject(a2, 'aliases_local.json') &&
    checkDatasetDuplicates(ds)
  );
  if (!okExtra) {
    console.error('[validate] extra checks failed');
    process.exit(1);
  }
  console.log('[validate] all checks passed');
}

main();

// Non-blocking referential integrity check (toggle strict via ALIAS_STRICT=1)
try {
  const dsPath = path.join(process.cwd(), 'public', 'app', 'dataset.json');
  if (fs.existsSync(dsPath)) {
    const ds = JSON.parse(fs.readFileSync(dsPath, 'utf8'));
    const titles = Array.isArray(ds) ? ds.map(x => x && (x.title || x.name || x.id)).filter(Boolean) : [];
    warnAliasTargetExistence(allAliases, titles);
  }
} catch (e) {
  console.warn('[validate] alias referential integrity check skipped:', e && e.message);
}

