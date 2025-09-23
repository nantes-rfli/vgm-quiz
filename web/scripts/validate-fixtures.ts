import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import type { ValidateFunction } from 'ajv';

const WEB_DIR = path.resolve(__dirname, '..');
const SCHEMAS_DIR = path.resolve(WEB_DIR, '../docs/api/schemas');
const FIXTURES_DIR = path.resolve(WEB_DIR, './mocks/fixtures');

async function* walk(dir: string): AsyncGenerator<string> {
  const ents = await readdir(dir, { withFileTypes: true });
  for (const e of ents) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (e.isFile() && p.endsWith('.json')) yield p;
  }
}

async function loadSchema(file: string) {
  const text = await readFile(path.join(SCHEMAS_DIR, file), 'utf-8');
  return JSON.parse(text);
}

function pick(file: string) {
  const rel = file.replace(/\\/g, '/');
  if (rel.includes('/rounds.start')) return 'rounds_start.schema.json';
  if (rel.includes('/rounds/next.') || rel.includes('/rounds.next')) return 'rounds_next.schema.json';
  return null;
}

async function main() {
  const ajv = new Ajv2020({ strict: true, allErrors: true });
  addFormats(ajv);
  const validators: Record<string, ValidateFunction> = {
    'rounds_start.schema.json': ajv.compile(await loadSchema('rounds_start.schema.json')),
    'rounds_next.schema.json': ajv.compile(await loadSchema('rounds_next.schema.json'))
  };

  let failed = 0;
  for await (const file of walk(FIXTURES_DIR)) {
    const schemaName = pick(file);
    if (!schemaName) continue;
    const data = JSON.parse(await readFile(file, 'utf-8'));
    const validate = validators[schemaName];
    const ok = validate(data);
    if (!ok) {
      failed++;
      console.error(`✖ ${path.relative(WEB_DIR, file)}  →  ${schemaName}`);
      for (const err of validate.errors ?? []) console.error('  -', err.instancePath || '(root)', err.message);
    } else {
      console.log(`✅ ${path.relative(WEB_DIR, file)}  →  ${schemaName}`);
    }
  }
  if (failed) {
    console.error('\nValidation failed');
    process.exit(1);
  }
  console.log('\nAll fixtures are valid ✔');
}

main().catch((e) => { console.error(e); process.exit(1); });
