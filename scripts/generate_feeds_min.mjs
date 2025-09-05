#!/usr/bin/env node
/**
 * Minimal single-item feeds (RSS + JSON) for vgm-quiz daily
 */
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function readJson(p){ return JSON.parse(await readFile(p,'utf-8')); }
function escapeXml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function siteBase(){ return 'https://nantes-rfli.github.io/vgm-quiz'; }

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

async function main(){
  const { date, item } = await getData();
  if (!item) {
    console.error('[feeds] no item; abort');
    process.exit(0);
  }
  const outDir = path.resolve(__dirname, '../public/daily');
  await mkdir(outDir, { recursive: true });

  const title = `[vgm-quiz] ${item.title || ''} — ${item.game || ''}`.trim();
  const url = `${siteBase()}/daily/${date}.html`;
  const updated = new Date(`${date}T00:00:00Z`).toUTCString();

  const rss = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0">\n  <channel>\n    <title>vgm-quiz (daily)</title>\n    <link>${siteBase()}/daily/</link>\n    <description>Daily one-track quiz</description>\n    <lastBuildDate>${updated}</lastBuildDate>\n    <item>\n      <title>${escapeXml(title)}</title>\n      <link>${url}</link>\n      <guid isPermaLink="true">${url}</guid>\n      <pubDate>${updated}</pubDate>\n      <description>${escapeXml(title)}</description>\n    </item>\n  </channel>\n</rss>`;

  const jsonFeed = {
    version: "https://jsonfeed.org/version/1.1",
    title: "vgm-quiz (daily)",
    home_page_url: `${siteBase()}/daily/`,
    items: [{
      id: url,
      url,
      title,
      date_published: `${date}T00:00:00Z`,
      content_text: title,
      attachments: [{
        url: `${siteBase()}/og/${date}.png`,
        mime_type: "image/png"
      }]
    }]
  };

  await writeFile(path.join(outDir, 'feed.xml'), rss, 'utf-8');
  await writeFile(path.join(outDir, 'feed.json'), JSON.stringify(jsonFeed, null, 2), 'utf-8');
  console.log('[feeds] generated: public/daily/feed.(xml|json)');
}

main().catch(e => { console.error(e); process.exit(1); });

