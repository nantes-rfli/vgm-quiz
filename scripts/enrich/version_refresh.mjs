#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';

const [,, dsPathArg, verPathArg] = process.argv;
const dsPath = dsPathArg || 'public/build/dataset.json';
const verPath = verPathArg || 'public/build/version.json';
const commit = process.env.GITHUB_SHA || 'dev';

if (!fs.existsSync(dsPath)) {
  console.error('Missing dataset: ' + dsPath);
  process.exit(1);
}

const buf = fs.readFileSync(dsPath);
const hash = crypto.createHash('sha256').update(buf).digest('hex');

let generated_at = new Date().toISOString();
try {
  const parsed = JSON.parse(buf.toString());
  if (parsed && typeof parsed === 'object' && parsed.generated_at) {
    generated_at = parsed.generated_at;
  }
} catch {}

let ver = { dataset_version: 1, content_hash: hash, generated_at, commit };
try {
  const prev = JSON.parse(fs.readFileSync(verPath, 'utf8'));
  ver = { ...prev, content_hash: hash, generated_at, commit };
} catch {}

fs.writeFileSync(verPath, JSON.stringify(ver));
console.log('[version] content_hash=' + hash);
