/**
 * assign_issue_ids.mjs
 * Add `"id"` to docs/issues/*.json items that don't have it, using a stable slug from title.
 * - slug: normalize NFKD → strip diacritics → [a-z0-9-] only → collapse dashes → trim → lower
 * - fallback: sha1(title).slice(0,8) when slug becomes empty
 * - dedupe: append -2, -3... if id already exists in this run
 */
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';

const DIR = 'docs/issues';

function slugify(title) {
  const base = title.normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // diacritics
    .replace(/＆/g, 'and')
    .replace(/[・･]/g, '-') // japanese middle dot variants to dash
    .replace(/[^A-Za-z0-9]+/g, '-') // non-alnum to dash
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  if (base) return base;
  return 'i-' + crypto.createHash('sha1').update(title).digest('hex').slice(0,8);
}

function withId(obj, id) {
  if (Object.prototype.hasOwnProperty.call(obj, 'id')) return obj;
  // Put id first to keep diffs readable
  return { id, ...obj };
}

function main() {
  if (!fs.existsSync(DIR)) {
    console.log('No docs/issues directory');
    process.exit(0);
  }
  const files = fs.readdirSync(DIR).filter(f => f.endsWith('.json'));
  if (files.length === 0) {
    console.log('No issue spec files');
    process.exit(0);
  }
  let total = 0;
  for (const f of files) {
    const p = path.join(DIR, f);
    let data;
    try {
      data = JSON.parse(fs.readFileSync(p, 'utf-8'));
    } catch (e) {
      console.error(`Skip ${f}: JSON parse error: ${e.message}`);
      continue;
    }
    if (!Array.isArray(data)) continue;
    const taken = new Set(data.map(x => x.id).filter(Boolean));
    let changed = 0;
    const out = data.map(item => {
      if (item.id) return item;
      const base = slugify(item.title || '');
      let id = base;
      let i = 1;
      while (taken.has(id)) {
        i += 1;
        id = `${base}-${i}`;
      }
      taken.add(id);
      changed += 1;
      return withId(item, id);
    });
    if (changed > 0) {
      fs.writeFileSync(p, JSON.stringify(out, null, 2) + '\n');
      console.log(`Updated ${f}: +${changed} id(s)`);
      total += changed;
    } else {
      console.log(`No change: ${f}`);
    }
  }
  if (total === 0) {
    console.log('No ids needed.');
  }
}

main();
