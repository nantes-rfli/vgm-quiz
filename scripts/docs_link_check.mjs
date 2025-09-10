#!/usr/bin/env node
// Simple local link checker for docs/*.md (relative links only)
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';

function listMd(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...listMd(p));
    else if (name.endsWith('.md')) out.push(p);
  }
  return out;
}

const root = new URL('.', import.meta.url).pathname.replace(/scripts\/$/, '');
const docsDir = join(root, 'docs');
const files = listMd(docsDir);
const relLinkRe = /(?<!\!)\[[^\]]+\]\((?!https?:|mailto:|#)([^)]+)\)/g; // ignore images/absolute/mail/anchors
const errors = [];

for (const file of files) {
  const dir = dirname(file);
  const txt = readFileSync(file, 'utf8');
  let m;
  while ((m = relLinkRe.exec(txt)) !== null) {
    const target = m[1].split('#')[0]; // ignore anchors
    const targetPath = join(dir, target);
    try {
      statSync(targetPath);
    } catch (e) {
      errors.push(`${file}: missing -> ${target}`);
    }
  }
}

if (errors.length) {
  console.error('Broken local links found:\n' + errors.join('\n'));
  process.exit(1);
} else {
  console.log('docs-link-check: OK');
}

