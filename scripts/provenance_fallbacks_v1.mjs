#!/usr/bin/env node
/**
 * provenance_fallbacks_v1.mjs
 * Ensure provenance exists for candidates (.jsonl) and authoring today (.json).
 * Usage:
 *   node scripts/provenance_fallbacks_v1.mjs --jsonl public/app/daily_candidates.jsonl
 *   node scripts/provenance_fallbacks_v1.mjs --json public/app/daily_auto.json
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import crypto from 'node:crypto';

function mkFallback(meta){
  const now = new Date().toISOString();
  const provider = meta?.provider || 'manual';
  const id = String(meta?.id || 'n/a');
  const base = `${meta?.title||''}|${meta?.game||''}|${meta?.composer||''}|${provider}|${id}`;
  const hash = 'sha1:'+crypto.createHash('sha1').update(base).digest('hex');
  return {
    source: provider==='manual' ? 'manual' : 'fallback',
    provider, id, collected_at: now, hash,
    license_hint: provider==='apple' ? 'official' : 'unknown'
  };
}

function readJSON(p){ return JSON.parse(fs.readFileSync(p,'utf-8')); }

async function runJsonl(p){
  const lines = fs.readFileSync(p,'utf-8').trim().split(/\r?\n/);
  const out = [];
  let fixed = 0, total = 0;
  for (const line of lines){
    if (!line.trim()) continue;
    total++;
    let o; try { o = JSON.parse(line); } catch { out.push(line); continue; }
    const has = !!(o?.meta?.provenance || o?.provenance);
    if (!has){
      const provider = o?.media?.provider || o?.clip?.provider || 'manual';
      const id = o?.media?.id || o?.clip?.id || null;
      const meta = {
        provider, id,
        title: o?.title || o?.track?.name || '',
        game: o?.game || o?.series || '',
        composer: o?.composer || (Array.isArray(o?.track?.composer)?o.track.composer.join(', '):o?.track?.composer||''),
      };
      const pv = mkFallback(meta);
      o.meta = Object.assign({}, o.meta||{}, { provenance: pv });
      fixed++;
    }
    out.push(JSON.stringify(o));
  }
  fs.writeFileSync(p, out.join('\n')+'\n', 'utf-8');
  const msg = `[provenance-fallbacks] jsonl fixed=${fixed} / total=${total}`;
  console.log(msg);
  if (process.env.GITHUB_STEP_SUMMARY){
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `\n- ${msg}\n`);
  }
}

async function runJson(p){
  const json = readJSON(p);
  const by = json?.by_date || {};
  let fixed = 0, total = 0;
  for (const d of Object.keys(by)){
    const day = by[d];
    const arr = Array.isArray(day?.items) ? day.items : (Array.isArray(day)?day:[]);
    for (const it of arr){
      total++;
      const has = !!(it?.meta?.provenance || it?.provenance);
      if (!has){
        const provider = it?.media?.provider || it?.clip?.provider || 'manual';
        const id = it?.media?.id || it?.clip?.id || null;
        const meta = {
          provider, id,
          title: it?.title || it?.track?.name || '',
          game: it?.game || it?.series || '',
          composer: it?.composer || (Array.isArray(it?.track?.composer)?it.track.composer.join(', '):it?.track?.composer||''),
        };
        const pv = mkFallback(meta);
        it.meta = Object.assign({}, it.meta||{}, { provenance: pv });
        fixed++;
      }
    }
  }
  fs.writeFileSync(p, JSON.stringify(json, null, 2), 'utf-8');
  const msg = `[provenance-fallbacks] json fixed=${fixed} / total=${total}`;
  console.log(msg);
  if (process.env.GITHUB_STEP_SUMMARY){
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `\n- ${msg}\n`);
  }
}

async function main(){
  const args = process.argv.slice(2);
  const jlIdx = args.indexOf('--jsonl');
  const jIdx  = args.indexOf('--json');
  if (jlIdx>=0 && args[jlIdx+1]){
    await runJsonl(args[jlIdx+1]);
  } else if (jIdx>=0 && args[jIdx+1]){
    await runJson(args[jIdx+1]);
  } else {
    console.error('[provenance-fallbacks] usage: --jsonl <path> | --json <path>');
    process.exit(2);
  }
}
main().catch(e=>{ console.error(e); process.exit(1); });

