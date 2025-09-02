// e2e/test_alias_no_norm_collision.mjs
// Goal: ensure alias canonical keys do not collide after normalization.
// This is a thin smoke test complementing JSON validators.
import { readFileSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

async function loadNormalize() {
  const modUrl = pathToFileURL(path.resolve('public/app/normalize.mjs')).href;
  const mod = await import(modUrl);
  return mod.normalize || mod.default || mod.norm || ((s)=>s);
}

async function main() {
  const normalize = await loadNormalize();
  const aliases = JSON.parse(readFileSync('public/app/aliases_local.json','utf-8'));
  const seen = new Map();
  let collisions = [];
  for (const key of Object.keys(aliases)) {
    const nk = normalize(key);
    const prev = seen.get(nk);
    if (prev && prev !== key) {
      collisions.push([prev, key, nk]);
    } else {
      seen.set(nk, key);
    }
  }
  if (collisions.length) {
    console.error('[alias norm-collision] Found canonical key collisions after normalization:');
    for (const [a,b,n] of collisions) console.error(`  - "${a}" vs "${b}" -> "${n}"`);
    throw new Error(`alias canonical collisions: ${collisions.length}`);
  }
  console.log('[alias norm-collision] ok');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
