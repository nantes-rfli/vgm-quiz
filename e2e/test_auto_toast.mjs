/* e2e/test_auto_toast.mjs
 * Smoke test: /app/?daily=YYYY-MM-DD&auto=1 shows "AUTO ON" toast.
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
function buildUrl(base, date) {
  const u = new URL(base);
  u.searchParams.set('daily', date);
  u.searchParams.set('auto', '1');
  u.searchParams.set('test', '1'); // avoid SW effects
  return u.toString();
}

async function run() {
  const base = process.env.APP_URL || 'https://nantes-rfli.github.io/vgm-quiz/app/';
  if (!base.endsWith('/app/')) throw new Error(`APP_URL must end with "/app/": ${base}`);
  const date = process.env.DATE || jstToday();
  const url = buildUrl(base, date);

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 } });
  const page = await ctx.newPage();

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

  // wait for toast root then toast
  const ok = await page.waitForSelector('#auto-toast-root .auto-toast', { timeout: 3000 }).then(()=>true).catch(()=>false);

  if (!ok) {
    const html = await page.content();
    await writeFile('auto_toast_failure.html', html, 'utf8');
    await page.screenshot({ path: 'auto_toast_failure.png', fullPage: true });
    await browser.close();
    throw new Error('AUTO toast not found (see auto_toast_failure.png / .html)');
  }

  // click OK and ensure it disappears
  await page.click('#auto-toast-root .auto-toast button');
  await page.waitForTimeout(100);
  await page.waitForSelector('#auto-toast-root .auto-toast', { state: 'detached', timeout: 2000 });

  await browser.close();
  console.log('[auto-toast] OK');
}

run().catch((e) => {
  console.error('[auto-toast] FAILED:', e);
  process.exit(1);
});

