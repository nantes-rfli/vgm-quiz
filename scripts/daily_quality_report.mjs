#!/usr/bin/env node
/**
 * daily_quality_report.mjs
 * `public/app/daily_auto.json` を解析し、当日分（または指定日）の品質サマリー Markdown を生成。
 *
 * 入力:
 *   --in <path>   : daily_auto.json（既定: public/app/daily_auto.json）
 *   --date <YYYY-MM-DD> : JST日付。未指定なら「最新の日付」を対象にする
 *   --out <path>  : 出力Markdown（既定: build/daily_quality_report.md）
 */

import fs from 'node:fs/promises';

function parseArgs(argv) {
  const a = { in: 'public/app/daily_auto.json', out: 'build/daily_quality_report.md' };
  for (let i = 2; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--in') a.in = argv[++i];
    else if (t === '--out') a.out = argv[++i];
    else if (t === '--date') a.date = argv[++i];
  }
  return a;
}

function norm(s) { return String(s||'').trim().toLowerCase(); }

function normalizeByDate(by_date) {
  if (Array.isArray(by_date)) {
    return by_date
      .map((d) => (d && typeof d === 'object' && 'date' in d) ? d
        : (typeof d === 'string' ? { date: d, items: [] } : null))
      .filter(Boolean);
  }
  if (by_date && typeof by_date === 'object') {
    return Object.entries(by_date).map(([date, v]) => {
      const items = Array.isArray(v?.items) ? v.items : Array.isArray(v) ? v : [];
      return { date, items };
    });
  }
  return [];
}

function histogram(values, edges) {
  const bins = new Array(edges.length - 1).fill(0);
  for (const v of values) {
    for (let i = 0; i < edges.length - 1; i++) {
      if (v >= edges[i] && v < edges[i+1]) { bins[i]++; break; }
      if (i === edges.length - 2 && v === edges[i+1]) { bins[i]++; } // include 1.0 in last bin
    }
  }
  return bins;
}

async function run() {
  const args = parseArgs(process.argv);
  const raw = await fs.readFile(args.in, 'utf8');
  const json = JSON.parse(raw);
  const by = normalizeByDate(json.by_date);
  if (!by.length) {
    throw new Error('daily_auto.json has empty by_date');
  }

  const dates = by.map(d => d.date).sort();
  const targetDate = args.date || dates[dates.length - 1];
  const target = by.find(d => String(d.date) === String(targetDate));
  if (!target) {
    throw new Error(`date ${targetDate} not found in by_date`);
  }

  const items = target.items || [];

  // Metrics
  const providerCounts = {};
  const choicesOk = [];
  const missingStart = [];
  const diffVals = [];
  const missingAnswers = [];
  const titleSamples = [];

  for (const it of items) {
    const p = norm(it?.clip?.provider);
    providerCounts[p] = (providerCounts[p] || 0) + 1;
    const ch = Array.isArray(it?.choices) ? it.choices : [];
    const correct = it?.answers?.canonical;
    const ok = correct && ch.includes(correct) && ch.length >= 4;
    choicesOk.push(ok);
    if (!(typeof it?.clip?.start === 'number' && isFinite(it.clip.start))) {
      missingStart.push(it);
    }
    if (typeof it?.difficulty === 'number' && isFinite(it.difficulty)) {
      diffVals.push(it.difficulty);
    }
    if (!correct) missingAnswers.push(it);
    if (titleSamples.length < 5) {
      titleSamples.push(`- ${it?.title ?? it?.track?.name ?? it?.game?.name ?? '(no title)'}`);
    }
  }

  const choicesOkRatio = choicesOk.length ? choicesOk.filter(Boolean).length / choicesOk.length : 0;
  const edges = [0,0.2,0.4,0.6,0.8,1.01];
  const hist = histogram(diffVals, edges);

  const providerLines = Object.entries(providerCounts)
    .map(([k,v]) => `- ${k || '(none)'}: ${v}`)
    .join('\n');

  const md = `# Daily Quality Report

**date**: \`${targetDate}\`
**items**: ${items.length}

## Providers
${providerLines || '- (none)'}

## Choices
- OK (has 4, includes correct): ${(choicesOkRatio*100).toFixed(0)}% (${choicesOk.filter(Boolean).length}/${choicesOk.length})

## Difficulty Histogram
- [0.0,0.2): ${hist[0]}
- [0.2,0.4): ${hist[1]}
- [0.4,0.6): ${hist[2]}
- [0.6,0.8): ${hist[3]}
- [0.8,1.0]: ${hist[4]}

## Missing fields
- items missing clip.start: ${missingStart.length}
- items missing answers.canonical: ${missingAnswers.length}

## Sample titles
${titleSamples.join('\n')}
`;

  await fs.mkdir('build', { recursive: true });
  await fs.writeFile(args.out, md, 'utf8');
  console.log(md);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
