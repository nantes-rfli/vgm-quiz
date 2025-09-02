// scripts/roadmap-guard.mjs
// Non-blocking checker: ensure planned features in docs/FEATURES.yml appear in docs/ROADMAP.md.
// Outputs a JSON summary to roadmap_guard_result.json

import { readFile, writeFile } from 'node:fs/promises';
import yaml from 'yaml';

function norm(s) {
  return (s || '').toString().toLowerCase();
}

async function main() {
  const featuresRaw = await readFile('docs/FEATURES.yml', 'utf8').catch(() => '');
  const roadmapRaw  = await readFile('docs/ROADMAP.md', 'utf8').catch(() => '');
  if (!featuresRaw || !roadmapRaw) {
    await writeFile('roadmap_guard_result.json', JSON.stringify({ ok:false, error:'missing files' }), 'utf8');
    return;
  }

  const features = yaml.parse(featuresRaw) || [];
  const roadmap = norm(roadmapRaw);
  const planned = (features || []).filter(x => (x?.status || '').toLowerCase() === 'planned');

  const missing = [];
  for (const f of planned) {
    const id = norm(f.id);
    const title = norm(f.title);
    // id or title must appear somewhere in Roadmap
    const found = (id && roadmap.includes(id)) || (title && roadmap.includes(title));
    if (!found) missing.push({ id: f.id, title: f.title, area: f.area });
  }

  const result = { ok: missing.length === 0, missing, counts: { planned: planned.length } };
  await writeFile('roadmap_guard_result.json', JSON.stringify(result, null, 2), 'utf8');
  console.log('[roadmap-guard] result:', result);
}

main().catch(async (e) => {
  console.error('[roadmap-guard] error:', e);
  try { await writeFile('roadmap_guard_result.json', JSON.stringify({ ok:false, error:String(e) }), 'utf8'); } catch {}
  process.exit(0); // non-blocking
});
