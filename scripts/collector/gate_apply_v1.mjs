// scripts/collector/gate_apply_v1.mjs
import fs from 'node:fs';
import path from 'node:path';
import { computeGateScore } from '../lib/gate_score.mjs';

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
  const scored = list.map(o => ({ ...o, gate: { score: Number(computeGateScore(o).toFixed(4)) } }));

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

