// scripts/collector/gate_apply_v1.mjs
import fs from 'node:fs';
import path from 'node:path';

const PROPOSALS = process.env.GATE_PROPOSALS || '';
const THRESHOLD = process.env.COLLECTOR_GATE_THRESHOLD || '';
const DRY_RUN = (() => {
  const v = String(process.env.GATE_DRY_RUN ?? '1').toLowerCase().trim();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
})();

if (!PROPOSALS) {
  console.error('GATE_PROPOSALS is required (path to proposals JSONL)');
  process.exit(1);
}

function readJsonl(p){
  const lines = fs.readFileSync(p,'utf-8').split(/\r?\n/).filter(Boolean);
  return lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}

function clamp01(x){ return Math.max(0, Math.min(1, x)); }

function notabilityOf(o){
  // 初期ヒューリスティク: previewありなら0.75、なければ0.55（将来はSPECに沿って算出）
  const lic = o?.meta?.provenance?.license_hint || 'unknown';
  return lic === 'preview' ? 0.75 : 0.55;
}

function providerTrust(p){
  const v = String(p||'').toLowerCase();
  if (v === 'apple') return 1.00;
  if (v === 'youtube_official') return 0.85;
  if (v === 'youtube') return 0.35;
  if (v === 'stub') return 0.10;
  return 0.20;
}

function guardScore(o){
  // 初期値 1.0 からの減点
  let g = 1.0;
  const prov = o?.meta?.provenance || {};
  const provKeys = ['source','provider','id','collected_at','hash','license_hint'];
  const provOk = provKeys.every(k => !!prov[k]);
  if (!provOk) return 0;

  if ((prov.license_hint||'unknown') === 'unknown') g *= 0.5;
  const comp = Array.isArray(o?.composer) ? o.composer : (Array.isArray(o?.track?.composer) ? o.track.composer : []);
  if (!comp.length) g *= 0.8;
  const theta = Number(o?.dedup?.theta || 0);
  if (theta >= 0.95) return 0;
  if (theta >= 0.85) g *= 0.5;
  return clamp01(g);
}

function score(o){
  const notab = notabilityOf(o);
  const ptrust = providerTrust(o?.meta?.provenance?.provider);
  const g = guardScore(o);
  const s = 0.5*notab + 0.3*ptrust + 0.2*g;
  return clamp01(s);
}

function writeJsonl(file, arr){
  if (!arr.length) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, arr.map(o=>JSON.stringify(o)).join('\n')+'\n','utf-8');
}

function nowStamp(){ return new Date().toISOString().replace(/[-:T]/g,'').slice(0,12); }

function main(){
  const list = readJsonl(PROPOSALS);
  const theta = THRESHOLD ? Number(THRESHOLD) : NaN;
  const accepted = [], queued = [], rejected = [];
  const scored = list.map(o => ({ ...o, gate: { score: Number(score(o).toFixed(4)) } }));

  for (const o of scored){
    const s = o.gate.score;
    if (!isNaN(theta)) {
      if (s >= theta) accepted.push(o);
      else if (s >= 0.50) queued.push(o);
      else rejected.push(o);
    }
  }

  const summary = [];
  summary.push('### Gate result');
  if (!isNaN(theta)) summary.push(`- threshold: ${theta}`);
  summary.push(`- total: ${scored.length}`);
  summary.push(`- auto_accept: ${accepted.length}`);
  summary.push(`- pr_queue: ${queued.length}`);
  summary.push(`- reject: ${rejected.length}`);

  try {
    const sum = process.env.GITHUB_STEP_SUMMARY;
    if (sum) fs.appendFileSync(sum, summary.join('\n')+'\n');
  } catch {}

  const stamp = nowStamp();
  if (!DRY_RUN && !isNaN(theta)) {
    writeJsonl(`resources/candidates/auto/accepted-${stamp}.jsonl`, accepted);
    writeJsonl(`resources/candidates/queue/queued-${stamp}.jsonl`, queued);
  }

  console.log(JSON.stringify({ total: scored.length, threshold: isNaN(theta)? null: theta, accepted: accepted.length, queued: queued.length, rejected: rejected.length, dryRun: DRY_RUN }, null, 2));
}

main();

