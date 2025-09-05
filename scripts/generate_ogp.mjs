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
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', year:'numeric', month:'2-digit', day:'2-digit' });
  const p = fmt.formatToParts(new Date()).reduce((o,v)=> (o[v.type]=v.value, o), {});
  return `${p.year}-${p.month}-${p.day}`;
}

async function ensureDir(p) {
  if (!existsSync(p)) await mkdir(p, { recursive: true });
}

function escapeXml(s){
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function inject(svg, fields) {
  let out = svg;
  out = out.replace('id="title">Track Title', `id="title">${escapeXml(fields.title)}`);
  out = out.replace('id="game">Game Title', `id="game">${escapeXml(fields.game)}`);
  out = out.replace('id="composer">Composer', `id="composer">${escapeXml(fields.composer)}`);
  // naive difficulty bar 0..1 -> 0..800 width
  const w = Math.max(0, Math.min(1, Number(fields.difficulty || 0))) * 800;
  out = out.replace('width="0" height="24" rx="12" fill="#60a5fa" id="difficultyBar"', `width="${Math.round(w)}" height="24" rx="12" fill="#60a5fa" id="difficultyBar"`);
  out = out.replace('id="difficulty">difficulty 0.00', `id="difficulty">difficulty ${(Number(fields.difficulty)||0).toFixed(2)}`);
  return out;
}

async function maybePng(svgBuf, outPng) {
  try {
    const { Resvg } = await import('@resvg/resvg-js');
    const r = new Resvg(svgBuf);
    const png = r.render().asPng();
    await writeFile(outPng, png);
    return true;
  } catch (e) {
    console.warn('[ogp] PNG skipped:', e?.message || e);
    return false;
  }
}

function isStr(x){ return typeof x === 'string' && x.trim().length>0; }

function pickLatest(by_date){
  const entries = Object.entries(by_date || {}).filter(([d,v])=>v && typeof v==='object');
  if (!entries.length) return null;
  entries.sort((a,b)=>a[0].localeCompare(b[0]));
  const [date, item] = entries[entries.length-1];
  return { date, item };
}

async function readDaily() {
  // prefer build/daily_today.json, else public/app/daily_auto.json
  const buildPath = path.resolve(__dirname, '../build/daily_today.json');
  if (existsSync(buildPath)) {
    const o = JSON.parse(await readFile(buildPath, 'utf-8'));
    // unwrap slim shape
    if (o && o.item && typeof o.item === 'object') {
      return { date: o.date, item: o.item };
    }
    if (o && o.by_date && typeof o.by_date==='object'){
      const p = pickLatest(o.by_date);
      if (p) return p;
    }
    if (o && (o.title || o.game || o.media)){
      return { date: todayStrJST(), item: o };
    }
  }
  const autoPath = path.resolve(__dirname, '../public/app/daily_auto.json');
  if (existsSync(autoPath)) {
    const obj = JSON.parse(await readFile(autoPath, 'utf-8'));
    const p = pickLatest(obj.by_date);
    if (p) return p;
  }
  return null;
}

async function main() {
  const tpl = path.resolve(__dirname, '../assets/og/template.svg');
  const outDir = path.resolve(__dirname, '../public/og');
  await ensureDir(outDir);

  const daily = await readDaily();
  if (!daily){
    console.warn('[ogp] no daily data found; skip');
    return;
  }
  const { date, item } = daily;

  const composer = item.composer || (item.track && item.track.composer) || '';
  const svg = await readFile(tpl, 'utf-8');
  const filled = inject(svg, {
    date,
    title: item.title || '',
    game: item.game || '',
    composer,
    difficulty: Number(item.difficulty||0)
  });

  const outSvg = path.join(outDir, `${date}.svg`);
  const outSvgLatest = path.join(outDir, `latest.svg`);
  await writeFile(outSvg, filled, 'utf-8');
  await writeFile(outSvgLatest, filled, 'utf-8');

  const outPng = path.join(outDir, `${date}.png`);
  const outPngLatest = path.join(outDir, `latest.png`);
  if (await maybePng(Buffer.from(filled), outPng)) {
    await writeFile(outPngLatest, await readFile(outPng));
  }

  console.log(`[ogp] wrote ${path.relative(process.cwd(), outSvg)} (+latest)`);
}

main().catch(e => { console.error(e); process.exit(1); });

