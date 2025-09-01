/* e2e/test_auto_badge_smoke.mjs
 * Smoke test: /app/?daily=YYYY-MM-DD&auto=1 renders and shows "AUTO" badge.
 * Falls back to &auto_any=1 if strict matching prevents "AUTO" showing.
 * On failure, saves screenshot and HTML for diagnosis.
 *
 * Env:
 *   APP_URL (must end with /app/, default: https://nantes-rfli.github.io/vgm-quiz/app/)
 *   DATE (YYYY-MM-DD, optional; default JST today)
 */
import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';

function jstToday() {
  const f = new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' });
  const s = f.format(new Date());
  const [y,m,d] = s.split('/');
  return `${y}-${m}-${d}`;
}

function buildUrl(base, date, opts={}) {
  const u = new URL(base);
  u.searchParams.set('daily', date);
  u.searchParams.set('auto', '1');
  if (opts.auto_any) u.searchParams.set('auto_any', '1');
  return u.toString();
}

async function hasAutoBadge(page) {
  return await page.evaluate(() => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if ((node.textContent || '').includes('AUTO')) return true;
    }
    return !!document.querySelector('[data-auto-badge], .auto-badge, [aria-label="AUTO"], [title="AUTO"]');
  });
}

async function run() {
  const base = process.env.APP_URL || 'https://nantes-rfli.github.io/vgm-quiz/app/';
  if (!base.endsWith('/app/')) throw new Error(`APP_URL must end with "/app/": ${base}`);
  const date = process.env.DATE || jstToday();

  const primary = buildUrl(base, date, { auto_any: false });
  const fallback = buildUrl(base, date, { auto_any: true });

  console.log('[auto-badge] base =', base);
  console.log('[auto-badge] date =', date);
  console.log('[auto-badge] url  =', primary);

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  const gotoOpts = { waitUntil: 'networkidle', timeout: 30000 };
  await page.goto(primary, gotoOpts);

  // check badge with retries
  let ok = await hasAutoBadge(page);
  if (!ok) {
    console.log('[auto-badge] Not found on strict URL, trying auto_any fallback:', fallback);
    await page.goto(fallback, gotoOpts);
    ok = await hasAutoBadge(page);
  }

  if (!ok) {
    const html = await page.content();
    await writeFile('auto_badge_failure.html', html, 'utf8');
    await page.screenshot({ path: 'auto_badge_failure.png', fullPage: true });
    await browser.close();
    throw new Error('AUTO badge not found (see auto_badge_failure.png / auto_badge_failure.html)');
  }

  console.log('[auto-badge] OK');
  await browser.close();
}

run().catch((e) => {
  console.error('[auto-badge] FAILED:', e);
  process.exit(1);
});
