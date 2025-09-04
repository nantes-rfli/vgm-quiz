/**
 * Validate docs/issues/*.json specs.
 * Rules:
 * - Array of objects with fields: title (string, non-empty), labels (array of non-empty strings), body (string)
 * - Optional id: [a-z0-9-]+, unique across all specs
 */
import fs from 'node:fs';
import path from 'node:path';

const DIR = 'docs/issues';
const files = fs.existsSync(DIR) ? fs.readdirSync(DIR).filter(f => f.endsWith('.json') && f !== 'state.json') : [];
if (files.length === 0) {
  console.log('No issue spec files.');
  process.exit(0);
}

const ids = new Set();
let ok = true;
for (const f of files) {
  const full = path.join(DIR, f);
  let data;
  try {
    data = JSON.parse(fs.readFileSync(full, 'utf-8'));
  } catch (e) {
    console.error(`✗ ${f}: JSON parse error: ${e.message}`);
    ok = false;
    continue;
  }
  if (!Array.isArray(data)) {
    console.error(`✗ ${f}: root must be an array`);
    ok = false;
    continue;
  }
  data.forEach((it, idx) => {
    const where = `${f}[${idx}]`;
    if (typeof it.title !== 'string' || !it.title.trim()) {
      console.error(`✗ ${where}: title must be non-empty string`);
      ok = false;
    }
    if (!Array.isArray(it.labels) || it.labels.length === 0 || it.labels.some(l => typeof l !== 'string' || !l.trim())) {
      console.error(`✗ ${where}: labels must be non-empty array of strings`);
      ok = false;
    }
    if (typeof it.body !== 'string') {
      console.error(`✗ ${where}: body must be string`);
      ok = false;
    }
    if (it.id !== undefined) {
      if (typeof it.id !== 'string' || !/^[a-z0-9-]+$/.test(it.id)) {
        console.error(`✗ ${where}: id must match [a-z0-9-]+`);
        ok = false;
      } else if (ids.has(it.id)) {
        console.error(`✗ ${where}: duplicate id ${it.id}`);
        ok = false;
      } else {
        ids.add(it.id);
      }
    }
  });
}

if (!ok) {
  process.exit(1);
} else {
  console.log('✓ issues specs OK');
}

