#!/usr/bin/env node
/**
 * Minimal feeds generator
 * - Generates single-item RSS/JSON feed for the latest daily item.
 * - Accepts wrapper {date,item} and by_date maps.
 */
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function siteBase() {
  // Best effort. Adjust if repository slug changes.
  return 'https://nantes-rfli.github.io/vgm-quiz';
}

function escapeXml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function pad(n){ return String(n).padStart(2,'0'); }
function todayStrJST() {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', year:'numeric', month:'2-digit', day:'2-digit' });
  const p = fmt.formatToParts(new Date()).reduce((o,v)=> (o[v.type]=v.value, o), {});
  return `${p.year}-${p.month}-${p.day}`;
}

function pickLatest(by_date){
  const entries = Object.entries(by_date || {}).filter(([d,v])=>v && typeof v==='object');
  if (!entries.length) return null;
  entries.sort((a,b)=>a[0].localeCompare(b[0]));
  const [date, item] = entries[entries.length-1];
  return { date, item };
}

async function readDaily() {
  const buildPath = path.resolve(__dirname, '../build/daily_today.json');
  if (existsSync(buildPath)) {
    const o = JSON.parse(await readFile(buildPath, 'utf-8'));
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
  const outDir = path.resolve(__dirname, '../public/daily');
  const daily = await readDaily();
  if (!daily) {
    console.warn('[feeds] no source JSON found (build/daily_today.json nor public/app/daily_auto.json) — skip');
    return;
  }
  await mkdir(outDir, { recursive: true });

  const { date, item } = daily;
  const urlBase = siteBase();
  const pageUrl = `${urlBase}/daily/${date}.html`;
  const ogUrlPng = `${urlBase}/og/${date}.png`;

  const composer = item.track?.composer || item.composer || 'N/A';
  const title = `[vgm-quiz] ${item.title || ''} — ${item.game || ''}`.trim();
  const description = `Daily VGM quiz for ${date}. Composer: ${composer}`;

  const rss = `<?xml version="1.0" encoding="UTF-8" ?>\n<rss version="2.0">\n  <channel>\n    <title>${escapeXml(title)}</title>\n    <link>${urlBase}</link>\n    <description>${escapeXml(description)}</description>\n    <item>\n      <title>${escapeXml(title)}</title>\n      <link>${pageUrl}</link>\n      <guid>${pageUrl}</guid>\n      <pubDate>${new Date().toUTCString()}</pubDate>\n      <description>${escapeXml(description)}</description>\n      <enclosure url="${ogUrlPng}" type="image/png" />\n    </item>\n  </channel>\n</rss>\n`;

  const jsonFeed = {
    version: "https://jsonfeed.org/version/1.1",
    title: "vgm-quiz daily",
    home_page_url: `${urlBase}/daily/latest.html`,
    items: [{
      id: pageUrl,
      url: pageUrl,
      title,
      content_text: description,
      image: ogUrlPng,
      date_published: new Date().toISOString(),
      attachments: [{
        url: ogUrlPng,
        mime_type: "image/png",
      }],
    }],
  };

  await writeFile(path.join(outDir, 'feed.xml'), rss, 'utf-8');
  await writeFile(path.join(outDir, 'feed.json'), JSON.stringify(jsonFeed, null, 2), 'utf-8');
  console.log('[feeds] generated: public/daily/feed.(xml|json)');
}

main();

