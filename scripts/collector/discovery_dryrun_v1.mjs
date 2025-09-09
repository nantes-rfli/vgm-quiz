// scripts/collector/discovery_dryrun_v1.mjs
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const QUERY = process.env.DISCOVERY_QUERY || '';
const LIMIT = parseInt(process.env.DISCOVERY_LIMIT || '25', 10);
const COUNTRY = process.env.DISCOVERY_COUNTRY || 'jp';
const ENTITY = 'song';

if (!QUERY) {
  console.error('DISCOVERY_QUERY is required');
  process.exit(1);
}

function nfkc(s){ try { return s.normalize('NFKC'); } catch { return s; } }
function normBase(s){ return nfkc(String(s||'')).toLowerCase().replace(/[\s\u3000]+/g,' ').trim(); }
function sha1hex(s){ return crypto.createHash('sha1').update(s).digest('hex'); }

function normalize(it){
  const title = it.trackName || it.trackCensoredName || it.trackViewUrl || '';
  const game = it.collectionName || it.collectionCensoredName || '';
  const album = it.collectionName || '';
  const composer = it.composerName ? [it.composerName] : (it.artistName ? [it.artistName] : []);
  const id = `itunes:${it.trackId}`;
  const collected_at = new Date().toISOString();
  const hash = sha1hex(normBase([title, game, album, (composer[0]||'')].join('|')));
  const license_hint = it.previewUrl ? 'preview' : 'unknown';

  return {
    title, game, album, composer,
    answers: { canonical: [title].filter(Boolean) },
    meta: { provenance: { source: 'discovery', provider: 'apple', id, collected_at, hash, license_hint } },
    raw: { country: it.country || COUNTRY } // small trace
  };
}

function trigramTokens(s){
  const t = s.replace(/\s+/g,' ');
  if (t.length<3) return new Set();
  const grams = new Set();
  for (let i=0;i<=t.length-3;i++) grams.add(t.slice(i,i+3));
  return grams;
}
function diceSim(aSet,bSet){
  if (aSet.size===0 && bSet.size===0) return 1;
  let inter=0;
  for (const g of aSet) if (bSet.has(g)) inter++;
  const denom = aSet.size + bSet.size;
  return denom===0 ? 0 : (2*inter)/denom;
}

function buildKey(o){
  const s = `${o.title||''} ${o.game||''} ${(o.composer&&o.composer.join(' '))||''}`;
  return trigramTokens(normBase(s));
}

function scoreConfidence(o){
  let s = 0.7;
  const prov = o?.meta?.provenance;
  if (prov?.license_hint === 'preview') s += 0.1;
  if (o?.composer?.length) s += 0.05;
  if (!o?.answers?.canonical?.length) s -= 0.2;
  if (!o?.title) s -= 0.3;
  return Math.max(0, Math.min(1, s));
}

async function main(){
  const url = new URL('https://itunes.apple.com/search');
  url.searchParams.set('term', QUERY);
  url.searchParams.set('entity', ENTITY);
  url.searchParams.set('country', COUNTRY);
  url.searchParams.set('limit', String(Math.max(1, Math.min(200, LIMIT))));

  const res = await fetch(url.toString());
  if (!res.ok){
    console.error('itunes search failed', res.status);
    process.exit(2);
  }
  const json = await res.json();
  const results = Array.isArray(json?.results) ? json.results : [];

  const proposals = results.map(normalize);
  // de-dup advice (within proposals)
  const grams = [];
  for (let i=0;i<proposals.length;i++){
    const g = buildKey(proposals[i]);
    grams.push(g);
    let best = 0;
    for (let j=0;j<i;j++){
      const sim = diceSim(g, grams[j]);
      if (sim > best) best = sim;
    }
    proposals[i].dedup = { theta: Number(best.toFixed(4)) };
    proposals[i].confidence = scoreConfidence(proposals[i]);
    proposals[i].notes = 'normalized from iTunes Search';
  }

  // write JSONL
  const stamp = new Date().toISOString().replace(/[-:T]/g,'').slice(0,12);
  const outDir = 'public/app/discovery';
  const outFile = path.join(outDir, `proposals-${stamp}.jsonl`);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outFile, proposals.map(o=>JSON.stringify(o)).join('\n')+'\n', 'utf-8');

  // KPI for Step Summary
  const total = proposals.length;
  const official = proposals.filter(o=>o?.meta?.provenance?.license_hint==='preview').length;
  const dupStrong = proposals.filter(o=>(o?.dedup?.theta||0)>=0.85).length;
  const hit = total; // after normalization
  const summary = [];
  summary.push('### Discovery KPI');
  summary.push(`- official_rate: ${total? (official/total).toFixed(2):'0.00'}`);
  summary.push(`- hit_rate: ${total? (hit/total).toFixed(2):'0.00'}`);
  summary.push(`- duplicate_ratio: ${total? (dupStrong/total).toFixed(2):'0.00'}`);
  summary.push(`- proposals: ${total}`);
  summary.push(`- artifact: ${outFile}`);

  try {
    const sumFile = process.env.GITHUB_STEP_SUMMARY;
    if (sumFile) fs.appendFileSync(sumFile, summary.join('\n')+'\n');
  } catch {}

  console.log(JSON.stringify({ total, official, dupStrong, outFile }, null, 2));
}

main().catch(e=>{ console.error(e); process.exit(3); });
