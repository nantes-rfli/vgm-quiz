#!/usr/bin/env node
/**
 * OGP static generator (SVG required, PNG optional)
 * - Prefers build/daily_today.json; falls back to public/app/daily_auto.json (by_date)
 * - Accepts wrapper {date,item} and flattens.
 * - Fills assets/og/template.svg and writes public/og/YYYY-MM-DD.svg and latest.svg
 * - If @resvg/resvg-js is available, also renders PNGs.
 */
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function pad(n){ return String(n).padStart(2, '0'); }
function todayStrJST() {
  const now = new Date();
  const jst = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  const y = jst.getFullYear();
  const m = pad(jst.getMonth()+1);
  const d = pad(jst.getDate());
  return `${y}-${m}-${d}`;
}

function unwrapEnvelope(x){
  if (x && typeof x === 'object') {
    if (x.item && (x.date || x.item.date)) return { date: x.date || x.item.date, item: x.item };
    if (x.date && (x.title || x.game || x.media)) { const { date, ...rest } = x; return { date, item: rest }; }
    if (x.by_date && typeof x.by_date === 'object') {
      const dates = Object.keys(x.by_date).sort();
      const date = dates[dates.length - 1];
      return { date, item: x.by_date[date] };
    }
    if (x.title || x.game || x.media) return { date: null, item: x };
    if (Array.isArray(x) && x.length) return { date: null, item: x[x.length-1] };
  }
  return { date: null, item: null };
}

async function loadLatest(){
  const prefer = path.resolve(__dirname, '../build/daily_today.json');
  const fallback = path.resolve(__dirname, '../public/app/daily_auto.json');
  let data, src;
  if (existsSync(prefer)) { data = JSON.parse(await readFile(prefer, 'utf-8')); src = prefer; }
  else if (existsSync(fallback)) { data = JSON.parse(await readFile(fallback, 'utf-8')); src = fallback; }
  else throw new Error('no source found');
  const { date, item } = unwrapEnvelope(data);
  return { date: date || todayStrJST(), item, src };
}

function inject(svg, fields){
  return svg
    .replace(/{{\s*title\s*}}/g, fields.title)
    .replace(/{{\s*game\s*}}/g, fields.game)
    .replace(/{{\s*composer\s*}}/g, fields.composer)
    .replace(/{{\s*date\s*}}/g, fields.date)
    .replace(/{{\s*difficulty\s*}}/g, String(fields.difficulty ?? 0));
}

async function maybePng(svgBuf, outFile){
  try {
    const { Resvg } = await import('@resvg/resvg-js');
    const r = new Resvg(svgBuf);
    const png = r.render().asPng();
    await writeFile(outFile, png);
    return true;
  } catch (e) {
    console.log('[ogp] PNG skipped (no @resvg/resvg-js)');
    return false;
  }
}

async function main(){
  const { date, item, src } = await loadLatest();
  if (!item) throw new Error(`no item to render (src=${src})`);

  const tpl = path.resolve(__dirname, '../assets/og/template.svg');
  const outDir = path.resolve(__dirname, '../public/og');
  if (!existsSync(outDir)) await mkdir(outDir, { recursive: true });

  const fields = {
    title: String(item.title || '').slice(0, 140),
    game: String(item.game || '').slice(0, 140),
    composer: String(item?.track?.composer || '').slice(0, 140),
    date,
    difficulty: typeof item.difficulty === 'number' ? item.difficulty : 0
  };
  const svg = await readFile(tpl, 'utf-8');
  const filled = inject(svg, fields);

  const outSvg = path.join(outDir, `${date}.svg`);
  const outSvgLatest = path.join(outDir, `latest.svg`);
  await writeFile(outSvg, filled, 'utf-8');
  await writeFile(outSvgLatest, filled, 'utf-8');

  const outPng = path.join(outDir, `${date}.png`);
  const outPngLatest = path.join(outDir, `latest.png`);
  const pngOk = await maybePng(Buffer.from(filled), outPng);
  if (pngOk) await writeFile(outPngLatest, await readFile(outPng));

  console.log(`[ogp] wrote ${path.relative(process.cwd(), outSvg)} (+latest)`);
}

main().catch(e=>{ console.error(e); process.exit(1); });
