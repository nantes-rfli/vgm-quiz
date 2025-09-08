
// Simple test harness for dedup_v1_5 using the fixture.
// Asserts that similar/duplicate collapse reduces items below input size.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const run = spawnSync('node', ['scripts/dedup_v1_5.mjs'], {
  env: { ...process.env,
    DEDUP_IN: 'test/fixtures/dedup_fixture.jsonl',
    DEDUP_OUT: 'test/fixtures/dedup_out.jsonl',
    DEDUP_REPLACE: '0',
    DEDUP_THETA_MAIN: '0.80',
    DEDUP_THETA_STRICT: '0.82',
  },
  stdio: 'inherit'
});

if (run.status !== 0) process.exit(run.status);
const inp = fs.readFileSync('test/fixtures/dedup_fixture.jsonl','utf-8').trim().split(/\n+/);
const out = fs.readFileSync('test/fixtures/dedup_out.jsonl','utf-8').trim().split(/\n+/);
if (!(out.length < inp.length)) {
  console.error('Expected deduped length < input length, but got', out.length, '>=', inp.length);
  process.exit(1);
}
console.log('dedup test passed:', { input: inp.length, output: out.length });

