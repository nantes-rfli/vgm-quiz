#!/usr/bin/env node
/**
 * OGP static generator (SVG required, PNG optional)
 * - Source: build/daily_today.json (preferred) OR public/app/daily_auto.json (by_date latest)
 * - Writes: public/og/YYYY-MM-DD.svg and latest.svg (and optional PNGs if resvg is available)
 */
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function readJson(p){ return JSON.parse(await readFile(p,'utf-8')); }

function unwrapDaily(obj){
  if (obj && typeof obj === 'object') {
    if ('item' in obj) return { date: obj.date, item: obj.item };
    const keys = Object.keys(obj);
    if (['title','game','composer','media','answers','track'].some(k => keys.includes(k))) {
      const { date=null, ...rest } = obj;
      return { date, item: rest };
    }
  }
  return { date: null, item: null };
}

function latestFromDailyAuto(obj){
  const dates = Object.keys(obj.by_date || {}).sort();
  const date = dates[dates.length-1];
  const item = date ? obj.by_date[date] : null;
  return { date, item };
}

function getComposer(item){
  const t = item.track && item.track.composer;
  const c = item.composer;
  if (Array.isArray(t) && t.length) return t.join(', ');
  if (typeof t === 'string' && t) return t;
  if (Array.isArray(c) && c.length) return c.join(', ');
  if (typeof c === 'string' && c) return c;
  return '';
}

async function getData(){
  const pToday = path.resolve(__dirname, '../build/daily_today.json');
  const pAuto  = path.resolve(__dirname, '../public/app/daily_auto.json');
  if (existsSync(pToday)) {
    const u = unwrapDaily(await readJson(pToday));
    if (u.item) return { src: pToday, ...u };
  }
  const u = latestFromDailyAuto(await readJson(pAuto));
  return { src: pAuto, ...u };
}

function fillTemplate(svg, {date,item}){
  const title = item.title || '';
  const game = item.game || '';
  const composer = getComposer(item) || '';
  return svg
    .replace(/id="date">[^<]*/,'id="date">'+(date||''))
    .replace(/id="title">[^<]*/,'id="title">'+escapeXml(title))
    .replace(/id="game">[^<]*/,'id="game">'+escapeXml(game))
    .replace(/id="composer">[^<]*/,'id="composer">'+escapeXml(composer));
}

function escapeXml(s){
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

async function maybePng(svgContent, outPng){
  try{
    const { Resvg } = await import('@resvg/resvg-js');
    const resvg = new Resvg(svgContent, { fitTo: { mode: 'width', value: 1200 } });
    const pngData = resvg.render().asPng();
    await writeFile(outPng, pngData);
    console.log('[ogp] PNG rendered:', outPng);
  } catch(e){
    console.warn('[ogp] PNG render skipped (resvg not available)');
  }
}

async function main(){
  const { date, item } = await getData();
  if (!item) {
    console.error('[ogp] no item; abort');
    process.exit(0);
  }
  const svgTmpl = await readFile(path.resolve(__dirname, '../assets/og/template.svg'),'utf-8');
  const filled = fillTemplate(svgTmpl, {date,item});

  const outDir = path.resolve(__dirname, '../public/og');
  await mkdir(outDir, { recursive: true });

  const svgPath = path.join(outDir, `${date}.svg`);
  const latestSvg = path.join(outDir, `latest.svg`);
  await writeFile(svgPath, filled,'utf-8');
  await writeFile(latestSvg, filled,'utf-8');
  console.log('[ogp] wrote', svgPath, 'and latest.svg');

  // optional PNG
  await maybePng(filled, path.join(outDir, `${date}.png`));
  await maybePng(filled, path.join(outDir, `latest.png`));
}

main().catch(e => { console.error(e); process.exit(1); });

