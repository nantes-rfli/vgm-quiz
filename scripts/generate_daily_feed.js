// Generate RSS feed for daily questions (JST-based)
const fs = require('fs');
const path = require('path');

const SITE_ORIGIN = process.env.SITE_ORIGIN || 'https://nantes-rfli.github.io';
const SITE_BASE_PATH = process.env.SITE_BASE_PATH || '/vgm-quiz';
const DAILY_BASE = `${SITE_ORIGIN}${SITE_BASE_PATH}/daily`;

function loadDailyMap() {
  const p = path.join(__dirname, '..', 'public', 'app', 'daily.json');
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function toRfc822JSTMidnight(dateStr) {
  // Create a Date at JST midnight, then output UTC string for RSS
  const d = new Date(`${dateStr}T00:00:00+09:00`);
  return d.toUTCString(); // RFC-1123 (acceptable for RSS pubDate)
}

function typeLabel(t) {
  switch (t) {
    case 'title→game': return 'Title → Game';
    case 'game→composer': return 'Game → Composer';
    case 'title→composer': return 'Title → Composer';
    default: return 'Title → Game';
  }
}

function escapeXml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function main() {
  const daily = loadDailyMap();
  const dates = Object.keys(daily).sort().reverse(); // newest first
  const limit = parseInt(process.env.DAILY_FEED_LIMIT || '60', 10);
  const selected = dates.slice(0, limit);

  const now = new Date().toUTCString();
  const channelTitle = 'VGM Quiz — Daily';
  const channelLink = `${DAILY_BASE}/`;
  const channelDesc = 'Daily 1-question VGM quiz (JST).';

  const items = selected.map((d) => {
    const v = daily[d] || {};
    const t = typeLabel(v.type || 'title→game');
    const link = `${DAILY_BASE}/${d}.html`;
    // Avoid spoilers: do not include track title in feed title/desc
    const title = `Daily ${d} — ${t}`;
    const pubDate = toRfc822JSTMidnight(d);
    const guid = link;
    return `
  <item>
    <title>${escapeXml(title)}</title>
    <link>${escapeXml(link)}</link>
    <guid isPermaLink="true">${escapeXml(guid)}</guid>
    <pubDate>${escapeXml(pubDate)}</pubDate>
  </item>`.trim();
  }).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(channelTitle)}</title>
    <link>${escapeXml(channelLink)}</link>
    <description>${escapeXml(channelDesc)}</description>
    <language>ja</language>
    <lastBuildDate>${escapeXml(now)}</lastBuildDate>
${items.split('\n').map((l) => '    ' + l).join('\n')}
  </channel>
</rss>
`;

  const outPath = path.join(__dirname, '..', 'public', 'daily', 'feed.xml');
  fs.writeFileSync(outPath, xml, 'utf8');
  console.log(`[generate_daily_feed] wrote ${outPath}`);
}

main();
