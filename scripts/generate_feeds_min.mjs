#!/usr/bin/env node
/**
 * Minimal feeds generator
 * - Generates single-item RSS/JSON feed for the latest daily item.
 * - Safe starter; can be extended to multi-item when an index becomes available.
 */
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import url from 'url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

function siteBase() {
  // Best effort. Adjust if repository slug changes.
  return 'https://nantes-rfli.github.io/vgm-quiz';
}

function pad(n){ return String(n).padStart(2, '0'); }
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

async function main() {
  const src = path.resolve(__dirname, '../build/daily_today.json');
  const outDir = path.resolve(__dirname, '../public/daily');
  if (!existsSync(src)) {
    console.warn(`[feeds] missing ${src} — skip`);
    return;
  }
  await mkdir(outDir, { recursive: true });

  let item = JSON.parse(await readFile(src, 'utf-8'));
  if (item && item.by_date && typeof item.by_date === 'object') {
    const keys = Object.keys(item.by_date);
    if (keys.length === 1) {
      item = { date: keys[0], ...item.by_date[keys[0]] };
    }
  }
  const date = item.date || todayStr();
  const urlBase = siteBase();
  const pageUrl = `${urlBase}/daily/${date}.html`;
  const ogUrlPng = `${urlBase}/og/${date}.png`;

  const title = `[vgm-quiz] ${item.title || ''} — ${item.game || ''}`.trim();
  const description = `Daily VGM quiz for ${date}. Composer: ${item.track?.composer || 'N/A'}`;

  const rss = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">
  <channel>
    <title>vgm-quiz daily</title>
    <link>${urlBase}/daily/latest.html</link>
    <description>One VGM question per day</description>
    <item>
      <title>${escapeXml(title)}</title>
      <link>${pageUrl}</link>
      <guid>${pageUrl}</guid>
      <description>${escapeXml(description)}</description>
      <enclosure url="${ogUrlPng}" type="image/png"/>
      <pubDate>${new Date().toUTCString()}</pubDate>
    </item>
  </channel>
</rss>`;

  const jsonFeed = {
    version: "https://jsonfeed.org/version/1.1",
    title: "vgm-quiz daily",
    home_page_url: `${urlBase}/daily/latest.html`, 
    items: [{
      id: pageUrl,
      url: pageUrl,
      title,
      content_text: description,
      date_published: new Date().toISOString(),
      attachments: [{
        url: ogUrlPng,
        mime_type: "image/png"
      }]
    }]
  };

  await writeFile(path.join(outDir, 'feed.xml'), rss, 'utf-8');
  await writeFile(path.join(outDir, 'feed.json'), JSON.stringify(jsonFeed, null, 2), 'utf-8');
  console.log('[feeds] generated: public/daily/feed.(xml|json)');
}

function escapeXml(s){
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

main();
