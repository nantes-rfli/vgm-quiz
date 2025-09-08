
/**
 * De-dup v1.5 (N-gram similarity + normalization)
 * - 3-gram Dice similarity on normalized string of (title + game + composer)
 * - exact dup: same provider|id
 * - suspicious-title penalty: -0.02 if either side contains suspicious keywords
 * - thresholds: θ_main=0.80, θ_strict=0.82
 * Input:  public/app/daily_candidates.jsonl
 * Output: public/app/daily_candidates_deduped.jsonl (and optionally replace original)
 */
import fs from 'node:fs';
import path from 'node:path';

const IN = process.env.DEDUP_IN || 'public/app/daily_candidates.jsonl';
const OUT = process.env.DEDUP_OUT || 'public/app/daily_candidates_deduped.jsonl';
const REPLACE_ORIGINAL = (process.env.DEDUP_REPLACE || '1') === '1';

const THETA_MAIN = Number(process.env.DEDUP_THETA_MAIN ?? '0.80');
const THETA_STRICT = Number(process.env.DEDUP_THETA_STRICT ?? '0.82');
const MODE_STRICT = (process.env.DEDUP_MODE ?? '').toLowerCase() === 'strict';
const THETA = MODE_STRICT ? THETA_STRICT : THETA_MAIN;

const SUSPICIOUS = [
  'cover','remix','extended','arrange','arranged','ost mix','long ver','longver','long version',
  'karaoke','instrumental','bgm edit','edit ver','tv size','tv-size','tvsize','full size','fullsize'
];
const PENALTY = 0.02;

function readJSONL(file){
  if (!fs.existsSync(file)) return [];
  const lines = fs.readFileSync(file, 'utf-8').split(/\r?\n/).filter(Boolean);
  return lines.map(l => {
    try { return JSON.parse(l); } catch { return null; }
  }).filter(Boolean);
}

function writeJSONL(file, arr){
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true });
  const lines = arr.map(o => JSON.stringify(o));
  fs.writeFileSync(file, lines.join('\n')+'\n');
}

function nfkc(s){ try { return s.normalize('NFKC'); } catch { return s; } }

function normalizeText(s){
  if (!s) return '';
  s = nfkc(String(s)).toLowerCase();
  // unify punctuation/space
  s = s.replace(/[【】\[\]（）()]/g, ' ');
  s = s.replace(/[^\p{L}\p{N}\s]/gu, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

function trigramTokens(s){
  const t = s.replace(/\s+/g, ' ');
  if (t.length < 3) return [];
  const grams = new Set();
  for (let i=0; i<=t.length-3; i++){
    grams.add(t.slice(i,i+3));
  }
  return grams;
}

function diceSim(aSet, bSet){
  if (aSet.size===0 && bSet.size===0) return 1;
  let inter = 0;
  for (const x of aSet) if (bSet.has(x)) inter++;
  return (2*inter) / (aSet.size + bSet.size || 1);
}

function suspiciousPenalty(titleA, titleB){
  const tA = (titleA||'').toLowerCase();
  const tB = (titleB||'').toLowerCase();
  const hit = SUSPICIOUS.some(k => tA.includes(k) || tB.includes(k));
  return hit ? PENALTY : 0;
}

function keyProviderId(o){
  const prov = o?.media?.provider || (o?.media?.apple ? 'apple' : null);
  const id = o?.media?.id || o?.media?.apple?.embedUrl || o?.media?.apple?.url || o?.media?.apple?.previewUrl;
  return prov && id ? `${prov}|${id}` : null;
}

function buildNorm(o){
  const parts = [o?.title, o?.game, o?.composer].map(normalizeText).filter(Boolean);
  const joined = parts.join(' ');
  const grams = trigramTokens(joined);
  return { joined, grams };
}

function main(){
  const arr = readJSONL(IN);
  const kept = [];
  const exactSeen = new Set();
  let dup_exact = 0, dup_similar = 0, examined = 0;
  const examples = [];

  const memo = new Map(); // index -> {norm, providerId}

  for (let i=0;i<arr.length;i++){
    const o = arr[i];
    examined++;
    const provId = keyProviderId(o);
    if (provId){
      if (exactSeen.has(provId)){
        dup_exact++;
        continue;
      }
    }
    const norm = buildNorm(o);
    let isDup = false;
    let best = { sim: 0, j: -1 };
    for (let j=0;j<kept.length;j++){
      const prev = memo.get(j);
      const sim0 = diceSim(norm.grams, prev.norm.grams);
      const sim = sim0 - suspiciousPenalty(o?.title, kept[j]?.title);
      if (sim > best.sim){ best = { sim, j }; }
      if (sim >= THETA){
        isDup = true;
        break;
      }
    }
    if (isDup){
      dup_similar++;
      // keep example sample (limit 5)
      if (examples.length < 5){
        examples.push({ a: o.title, b: kept[best.j]?.title, sim: Number(best.sim.toFixed(3)) });
      }
      continue;
    }
    // Keep
    const idx = kept.push(o) - 1;
    memo.set(idx, { norm, providerId: provId });
    if (provId) exactSeen.add(provId);
  }

  writeJSONL(OUT, kept);

  // Optional replace
  if (REPLACE_ORIGINAL){
    fs.copyFileSync(OUT, IN);
  }

  // Step Summary
  try {
    const SUM = process.env.GITHUB_STEP_SUMMARY;
    if (SUM){
      const lines = [];
      lines.push('### de-dup v1.5 summary');
      lines.push(`- examined: **${examined}**`);
      lines.push(`- dup-exact: **${dup_exact}**`);
      lines.push(`- dup-similar (≥θ=${THETA.toFixed(2)}): **${dup_similar}**`);
      if (examples.length){
        lines.push('- samples:');
        for (const ex of examples){
          lines.push(`  - "${ex.a}" ↔ "${ex.b}" (sim=${ex.sim})`);
        }
      }
      fs.appendFileSync(SUM, lines.join('\n')+'\n');
    }
  } catch {}

  console.log(JSON.stringify({ examined, dup_exact, dup_similar, kept: kept.length, theta: THETA }, null, 2));
}

main();

