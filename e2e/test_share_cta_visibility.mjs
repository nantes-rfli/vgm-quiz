/* e2e/test_share_cta_visibility.mjs
 * Purpose: Ensure daily share page exposes a visible CTA before redirect.
 * Strategy: Fetch share HTML with ?no-redirect=1 and ensure either:
 *  - "AUTOで遊ぶ" text exists, OR
 *  - a link to /app/?daily=YYYY-MM-DD (with or without auto=1) exists.
 *
 * Env:
 *   SHARE_BASE (must end with /daily/, default: https://nantes-rfli.github.io/vgm-quiz/daily/)
 *   DATE       (YYYY-MM-DD, optional; default JST today)
 */
import { writeFile } from 'node:fs/promises';

function jstToday() {
  const f = new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' });
  const s = f.format(new Date());
  const [y,m,d] = s.split('/');
  return `${y}-${m}-${d}`;
}

async function fetchText(url) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return await res.text();
}

function hasCtaDaily(html, date) {
  const lower = html.toLowerCase();
  if (html.includes('AUTOで遊ぶ')) return true;
  if (lower.includes('/app/?daily=' + date.toLowerCase() + '&auto=1')) return true;
  if (lower.includes('/app/?daily=' + date.toLowerCase())) return true;
  return false;
}

function hasLatestIndicator(html, date) {
  // Accept either the same CTA as daily, or a clear redirect target marker to the dated page
  if (hasCtaDaily(html, date)) return true;
  const lower = html.toLowerCase();
  // allow common latest redirect patterns
  if (lower.includes(`/daily/${date.toLowerCase()}.html`)) return true;                  // absolute path
  if (lower.includes(`href="./${date.toLowerCase()}.html"`)) return true;               // relative link in href
  if (lower.includes(`>${date.toLowerCase()}<`)) return true;                           // anchor text contains the date
  if (lower.includes(`location.href`) && lower.includes(date.toLowerCase())) return true;
  return false;
}

async function run() {
  const base = process.env.SHARE_BASE || 'https://nantes-rfli.github.io/vgm-quiz/daily/';
  if (!base.endsWith('/daily/')) throw new Error(`SHARE_BASE must end with "/daily/": ${base}`);
  const date = process.env.DATE || jstToday();

  const share = `${base}${date}.html?no-redirect=1`;
  const latest = `${base}latest.html?no-redirect=1`;

  console.log('[share] check:', share);
  const html = await fetchText(share);

  if (!hasCtaDaily(html, date)) {
    await writeFile('share_cta_failure.html', html, 'utf8');
    throw new Error('CTA not found in daily share page (see share_cta_failure.html)');
  }
  console.log('[share] daily OK');

  console.log('[share] check:', latest);
  const html2 = await fetchText(latest);
  if (!hasLatestIndicator(html2, date)) {
    await writeFile('share_cta_latest_failure.html', html2, 'utf8');
    throw new Error('CTA not found in latest share page (see share_cta_latest_failure.html)');
  }
  console.log('[share] latest OK');
}

run().catch((e) => {
  console.error('[share] FAILED:', e);
  process.exit(1);
});
