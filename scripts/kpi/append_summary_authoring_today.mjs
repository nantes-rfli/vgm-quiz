#!/usr/bin/env node
/**
 * Append KPI summary for build/daily_today.json to $GITHUB_STEP_SUMMARY and echo to console.
 */
import fs from 'node:fs';

const args = process.argv.slice(2);
let IN = 'build/daily_today.json';
for (let i=0;i<args.length;i++){
  if (args[i]==='--in') IN = args[i+1];
}

function readJSON(p){
  return JSON.parse(fs.readFileSync(p,'utf-8'));
}

function main(){
  if (!fs.existsSync(IN)){
    const warn = `::warning::KPI authoring: file not found: ${IN}`;
    console.log(warn);
    const SUM = process.env.GITHUB_STEP_SUMMARY;
    if (SUM) fs.appendFileSync(SUM, warn+'\n');
    return;
  }
  const j = readJSON(IN);
  const it = j.item || j.flat || j;
  const ok = {
    title: !!it.title,
    game: !!it.game,
    composer: !!it.composer,
    answers: !!(it.answers && (it.answers.canonical || it.answers.acceptables)),
    media: !!(it.media && (it.media.apple && (it.media.apple.embedUrl||it.media.apple.url||it.media.apple.previewUrl) || (it.media.provider==='youtube' && it.media.id)))
  };
  const prov = it.media?.apple ? 'apple' : (it.media?.provider || 'none');
  const lines = [];
  lines.push(`### KPI (authoring today)`);
  lines.push(`- ok: title=${ok.title}, game=${ok.game}, composer=${ok.composer}, answers=${ok.answers}, media=${ok.media}`);
  lines.push(`- media.provider: **${prov}**`);
  const SUM = process.env.GITHUB_STEP_SUMMARY;
  if (SUM) fs.appendFileSync(SUM, lines.join('\n')+'\n');
  console.log(lines.join('\n'));
}
main();
