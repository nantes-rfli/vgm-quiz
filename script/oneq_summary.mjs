#!/usr/bin/env node
// Append KPI summary for oneq publish to $GITHUB_STEP_SUMMARY
import fs from 'node:fs';
import path from 'node:path';

const SUMMARY = process.env.GITHUB_STEP_SUMMARY;
const DATE = process.env.ONEQ_DATE || new Date().toISOString().slice(0,10);
const p = path.resolve('public/daily', `${DATE}.json`);

function readJSON(file){ try{ return JSON.parse(fs.readFileSync(file,'utf8')); }catch{ return null; } }
const data = readJSON(p);

let out = [];
out.push(`# oneq publish summary (${DATE})`);
if (!data) {
  out.push(`- 状態: 失敗（ファイル未生成）`);
  out.push(`- パス: \`${p}\``);
} else {
  const q = data.question || {};
  const m = data.media || {};
  out.push(`- 状態: 成功`);
  out.push(`- タイトル: **${(q.title||'(unknown)')}**`);
  out.push(`- ゲーム: ${q.game || '(unknown)'}`);
  out.push(`- 作曲: ${q.composer || '(unknown)'}`);
  out.push(`- track/id: \`${q['track/id'] || '(none)'}\``);
  out.push(`- メディア: \`${m.provider || '(none)'}:${m.id || '(none)'}\``);
}

const text = out.join('\n') + '\n';
console.log(text);
if (SUMMARY) fs.appendFileSync(SUMMARY, '\n' + text);
