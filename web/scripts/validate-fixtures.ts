import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import type { AnySchema, ErrorObject, ValidateFunction } from 'ajv';

type Pair = { fixtureRel: string; schemaRel: string; schemaId?: string };

// --- Config ---------------------------------------------------------------

// Base dirs (script assumed at ./web/scripts)
const WEB_DIR = path.resolve(__dirname, '..');
const SCHEMAS_DIR = path.resolve(WEB_DIR, '../docs/api/schemas');

// Fixture → Schema mapping
const PAIRS: Pair[] = [
  { fixtureRel: 'mocks/fixtures/rounds.start.ok.json', schemaRel: 'rounds_start.schema.json' },
  { fixtureRel: 'mocks/fixtures/rounds.next.ok.json', schemaRel: 'rounds_next.schema.json' },
  { fixtureRel: 'mocks/fixtures/rounds.next.finished.json', schemaRel: 'rounds_next.schema.json' },
];

// --- Ajv setup ------------------------------------------------------------

const ajv = new Ajv2020({
  allErrors: true,
  strict: false,
  allowUnionTypes: true
});
addFormats(ajv);

async function preloadSchemas(dir: string) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const ent of entries) {
    if (!ent.isFile()) continue;
    if (!ent.name.endsWith('.json')) continue;
    const full = path.join(dir, ent.name);
    const buf = await readFile(full, 'utf8');
    const schema = JSON.parse(buf) as AnySchema;
    const maybeId = (schema as { $id?: string }).$id;
    const id = maybeId || pathToFileURL(full).href;
    ajv.addSchema(schema, id);
  }
}

function formatErrors(errors: ErrorObject[] | null | undefined): string {
  if (!errors || !errors.length) return '';
  return errors.map((e) => {
    const loc = e.instancePath || e.schemaPath || '';
    const msg = e.message || '';
    const add = e.params ? ` ${JSON.stringify(e.params)}` : '';
    return `  • ${loc} ${msg}${add}`;
  }).join('\n');
}

async function main() {
  await preloadSchemas(SCHEMAS_DIR);

  let failed = 0;
  for (const pair of PAIRS) {
    const fixtureAbs = path.join(WEB_DIR, pair.fixtureRel);
    const schemaAbs = path.join(SCHEMAS_DIR, pair.schemaRel);

    // resolve schema id (prefer $id)
    const schemaRaw = await readFile(schemaAbs, 'utf8');
    const schemaObj = JSON.parse(schemaRaw) as AnySchema;
    const maybeId = (schemaObj as { $id?: string }).$id;
    const schemaId = maybeId || pathToFileURL(schemaAbs).href;

    const existing = ajv.getSchema(schemaId) as ValidateFunction | undefined;
    const validate = existing ?? ajv.compile(schemaObj);

    let data: unknown;
    try {
      data = JSON.parse(await readFile(fixtureAbs, 'utf8'));
    } catch (e) {
      console.error(`✖ Fixture not found or JSON parse error: ${pair.fixtureRel}`);
      console.error(String(e));
      failed++;
      continue;
    }

    const ok = validate(data);
    if (!ok) {
      failed++;
      console.error(`❌ ${pair.fixtureRel}  →  ${pair.schemaRel}`);
      console.error(formatErrors(validate.errors));
    } else {
      console.log(`✅ ${pair.fixtureRel}  →  ${pair.schemaRel}`);
    }
  }

  if (failed) {
    console.error(`\nValidation failed: ${failed} file(s).`);
    process.exit(1);
  } else {
    console.log('\nAll fixtures are valid ✔');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
