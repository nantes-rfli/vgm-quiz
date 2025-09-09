#!/usr/bin/env node
import { readFile, writeFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

function execNode(args, opts={}) {
  return new Promise((resolve, reject) => {
    const ps = spawn(process.execPath, args, { stdio: ['ignore','pipe','pipe'], ...opts });
    let out = '', err = '';
    ps.stdout.on('data', d => out += String(d));
    ps.stderr.on('data', d => err += String(d));
    ps.on('close', (code) => code === 0 ? resolve({code, out, err}) : reject(new Error(err || `exit ${code}`)));
  });
}

function parseArg(flag, def) {
  const i = process.argv.indexOf(flag);
  if (i >= 0 && i+1 < process.argv.length) return process.argv[i+1];
  return def;
}

async function main(){
  const jsonPath = parseArg('--json', 'build/daily_today.json');
  const orig = await readFile(jsonPath, 'utf8');
  const tmp = await mkdtemp(join(tmpdir(), 'prov-'));
  const copy = join(tmp, 'daily_today.json');
  await writeFile(copy, orig, 'utf8');

  // re-apply fallback; idempotent => no diff
  await execNode(['scripts/provenance_fallbacks_v1.mjs', '--json', copy], { cwd: process.cwd() });
  const after = await readFile(copy, 'utf8');

  if (orig !== after) {
    const max = 1024;
    const msg = [
      'Provenance fallback is NOT idempotent: running twice changed the file.',
      '--- before (head) ---',
      orig.slice(0, max),
      '--- after  (head) ---',
      after.slice(0, max)
    ].join('\n');
    throw new Error(msg);
  }
  console.log('Idempotency OK: no changes after re-applying fallback.');
}

main().catch(e => {
  console.error(e?.message || e);
  process.exit(1);
});

