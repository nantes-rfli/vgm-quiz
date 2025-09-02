/* e2e/test_keyboard_flow_smoke.mjs
 * Purpose: Minimal regression check that the quiz can be operated with keyboard only.
 * Strategy: Open app, Tab to first "button-like" choice, press Enter,
 *           and verify a plausible "answered" signal (selected/pressed/dialog/etc.).
 *
 * Env:
 *   APP_URL (must end with /app/, default: https://nantes-rfli.github.io/vgm-quiz/app/)
 *   DATE    (YYYY-MM-DD, optional; default JST today)
 */
import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';

function jstToday() {
  const f = new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' });
  const s = f.format(new Date());
  const [y,m,d] = s.split('/');
  return `${y}-${m}-${d}`;
}

function buildUrl(app, date) {
  const u = new URL(app);
  u.searchParams.set('daily', date);
  u.searchParams.set('autostart', '0');
  u.searchParams.set('lhci', '1');
  u.searchParams.set('nomedia', '1');
  u.searchParams.set('seed', 'kb');
  return u.toString();
}

async function findChoiceViaTab(page, maxHops = 20) {
  for (let i = 0; i < maxHops; i++) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return { ok:false };
      const tag = (el.tagName || '').toLowerCase();
      const role = el.getAttribute?.('role') || '';
      const cls = (el.className || '').toString();
      const txt = (el.textContent || '').trim();
      // button-like heuristics
      const isBtn = tag === 'button' || role === 'button' || el.hasAttribute('tabindex');
      return {
        ok: isBtn && txt.length > 0,
        tag, role, cls, txt,
        selector: (() => {
          try { el.setAttribute('data-kb-probe','1'); return '[data-kb-probe="1"]'; } catch(e) { return null; }
        })()
      };
    });
    if (info.ok) return info;
  }
  return { ok:false };
}

async function answeredSignal(page) {
  return await page.evaluate(() => {
    // A union of common patterns after answering.
    const el = document.activeElement;
    const sel = [
      '[role="dialog"]',
      '.selected, .correct, .wrong',
      '[aria-pressed="true"]',
      '[data-selected], [data-state="selected"]',
      // hints of result area
      '.result, .results, [data-testid*="result"], [data-role="result"]'
    ].join(',');
    const any = document.querySelector(sel);
    // also allow currently-focused to look selected/disabled
    const looksPressed = el && (el.getAttribute('aria-pressed') === 'true' || el.hasAttribute('disabled') || /selected|active/.test(el.className || ''));
    return !!(any || looksPressed);
  });
}

async function run() {
  const base = process.env.APP_URL || 'https://nantes-rfli.github.io/vgm-quiz/app/';
  if (!base.endsWith('/app/')) throw new Error(`APP_URL must end with "/app/": ${base}`);
  const date = process.env.DATE || jstToday();
  const url  = buildUrl(base, date);

  console.log('[kb] url =', url);
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const gotoOpts = { waitUntil: 'networkidle', timeout: 30000 };

  await page.goto(url, gotoOpts);
  await page.waitForSelector('body', { timeout: 15000 });

  // Move focus into document
  await page.focus('body');

  const info = await findChoiceViaTab(page);
  if (!info.ok) {
    await writeFile('kb_flow_failure.html', await page.content(), 'utf8');
    await page.screenshot({ path: 'kb_flow_failure.png', fullPage: true });
    await browser.close();
    throw new Error('Could not reach a button-like choice with Tab (see kb_flow_failure.*)');
  }
  console.log('[kb] focused candidate:', info);

  // Activate with Enter
  await page.keyboard.press('Enter');

  // Check for an "answered" signal
  const ok = await answeredSignal(page);
  if (!ok) {
    await writeFile('kb_flow_failure.html', await page.content(), 'utf8');
    await page.screenshot({ path: 'kb_flow_failure.png', fullPage: true });
    await browser.close();
    throw new Error('After Enter key, no plausible answered signal found (see kb_flow_failure.*)');
  }

  console.log('[kb] OK');
  await browser.close();
}

run().catch(async (e) => {
  console.error('[kb] FAILED:', e);
  process.exit(1);
});
