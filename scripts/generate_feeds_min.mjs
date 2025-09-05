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
  return { date: date || new Date().toISOString().slice(0,10), item, src };
}

function escapeXml(s){
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

async function main(){
  const { date, item } = await loadLatest();
  if (!item) throw new Error('no item for feeds');

  const outDir = path.resolve(__dirname, '../public/daily');
  if (!existsSync(outDir)) await mkdir(outDir, { recursive: true });

  const title = item.title || 'Untitled';
  const game = item.game || '';
  const composer = (item?.track?.composer) ? ` — ${item.track.composer}` : '';
  const ogUrl = `${siteBase()}/og/${date}.png`;
  const pageUrl = `${siteBase()}/daily/${date}.html`;

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>VGM Quiz — Daily</title>
    <link>${siteBase()}</link>
    <description>Daily game music quiz</description>
    <item>
      <title>${escapeXml(`${title} — ${game}${composer}`)}</title>
      <link>${pageUrl}</link>
      <guid>${pageUrl}</guid>
      <pubDate>${new Date(date+'T00:00:00Z').toUTCString()}</pubDate>
      <description>${escapeXml('Play today\'s quiz')}</description>
      <enclosure url="${ogUrl}" type="image/png"/>
    </item>
  </channel>
</rss>
`;

  const jsonFeed = {
    version: 'https://jsonfeed.org/version/1.1',
    title: 'VGM Quiz — Daily',
    home_page_url: siteBase(),
    feed_url: `${siteBase()}/daily/feed.json`,
    items: [{
      id: pageUrl,
      url: pageUrl,
      title: `${title} — ${game}${composer}`,
      date_published: new Date(date+'T00:00:00Z').toISOString(),
      attachments: [{ url: ogUrl, mime_type: 'image/png' }]
    }]
  };

  await writeFile(path.join(outDir, 'feed.xml'), rss, 'utf-8');
  await writeFile(path.join(outDir, 'feed.json'), JSON.stringify(jsonFeed, null, 2), 'utf-8');
  console.log('[feeds] generated: public/daily/feed.(xml|json)');
}

main().catch(e=>{ console.error(e); process.exit(1); });

