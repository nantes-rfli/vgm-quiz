#!/usr/bin/env node
/**
 * OGP static generator (SVG required, PNG optional)
 * - Reads build/daily_today.json
 * - Fills assets/og/template.svg and writes public/og/YYYY-MM-DD.svg and latest.svg
 * - If @resvg/resvg-js is available, also renders PNGs.
 */
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import url from 'url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

function pad(n){ return String(n).padStart(2, '0'); }
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

async function ensureDir(p) {
  if (!existsSync(p)) await mkdir(p, { recursive: true });
}

function inject(svg, fields) {
  let out = svg;
  out = out.replace('id="date">YYYY-MM-DD', `id="date">${fields.date}`);
  out = out.replace('id="title">Track Title', `id="title">${escapeXml(fields.title)}`);
  out = out.replace('id="game">Game Title', `id="game">${escapeXml(fields.game)}`);
  out = out.replace('id="composer">Composer', `id="composer">${escapeXml(fields.composer)}`);
  out = out.replace('width="0" height="24" rx="12" fill="#60a5fa" id="difficultyBar"', `width="${Math.round((fields.difficulty||0)*800)}" height="24" rx="12" fill="#60a5fa" id="difficultyBar"`);
  out = out.replace('id="difficulty">difficulty 0.00', `id="difficulty">difficulty ${(fields.difficulty||0).toFixed(2)}`);
  return out;
}

function escapeXml(s){
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

async function maybePng(svgBuf, outPng) {
  try {
    const { Resvg } = await import('@resvg/resvg-js'); // optional dependency
    const resvg = new Resvg(svgBuf, { fitTo: { mode: 'width', value: 1200 } });
    const png = resvg.render().asPng();
    await writeFile(outPng, png);
    return true;
  } catch (e) {
    console.warn('[ogp] PNG render skipped (resvg not installed):', e.message || e);
    return false;
  }
}

async function main() {
  const src = path.resolve(__dirname, '../build/daily_today.json');
  const tpl = path.resolve(__dirname, '../assets/og/template.svg');
  const outDir = path.resolve(__dirname, '../public/og');
  await ensureDir(outDir);

  const raw = await readFile(src, 'utf-8').catch(()=>null);
  if (!raw) {
    console.warn(`[ogp] missing ${src} — skip`);
    return;
  }
  let item = JSON.parse(raw);
  if (item && item.by_date && typeof item.by_date === 'object') {
    const keys = Object.keys(item.by_date);
    if (keys.length === 1) {
      item = { date: keys[0], ...item.by_date[keys[0]] };
    }
  }
  const date = item.date || todayStr();
  const fields = {
    date,
    title: item.title || '',
    game: item.game || '',
    composer: item.track?.composer || '',
    difficulty: typeof item.difficulty === 'number' ? item.difficulty : 0
  };
  const svg = await readFile(tpl, 'utf-8');
  const filled = inject(svg, fields);

  const outSvg = path.join(outDir, `${date}.svg`);
  const outSvgLatest = path.join(outDir, `latest.svg`);
  await writeFile(outSvg, filled, 'utf-8');
  await writeFile(outSvgLatest, filled, 'utf-8');

  // Try PNG (optional)
  const outPng = path.join(outDir, `${date}.png`);
  const outPngLatest = path.join(outDir, `latest.png`);
  const pngOk = await maybePng(Buffer.from(filled), outPng);
  if (pngOk) await writeFile(outPngLatest, await readFile(outPng));

  console.log(`[ogp] generated: ${path.relative(process.cwd(), outSvg)} (+png:${pngOk})`);
}

main();
