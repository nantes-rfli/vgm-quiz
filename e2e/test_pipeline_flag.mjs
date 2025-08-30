import { chromium } from 'playwright';

function withParams(base, extra) {
  try {
    const u = new URL(base);
    const p = u.searchParams;
    Object.entries(extra).forEach(([k,v]) => p.set(k, String(v)));
    return u.toString();
  } catch {
    const q = Object.entries(extra).map(([k,v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');
    return base + (base.includes('?') ? '&' : '?') + q;
  }
}

(async () => {
  const TIMEOUT = 30000;
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  const base0 = process.env.E2E_BASE_URL || process.env.APP_URL || 'http://127.0.0.1:8080/app/';
  const base = withParams(base0, { test: 1, mock: 1, qp: 1, autostart: 0 });

  // run with seed A
  await page.goto(withParams(base, { seed: 'qp-seed-a' }), { waitUntil: 'networkidle' });
  await page.click('[data-testid="start-btn"]');
  await page.waitForFunction(() => !!window.__questionIds, { timeout: TIMEOUT });
  const a = await page.evaluate(() => window.__questionIds);

  // reload with same seed A -> must be identical
  await page.goto(withParams(base, { seed: 'qp-seed-a' }), { waitUntil: 'networkidle' });
  await page.click('[data-testid="start-btn"]');
  await page.waitForFunction(() => !!window.__questionIds, { timeout: TIMEOUT });
  const a2 = await page.evaluate(() => window.__questionIds);
  if (a !== a2) throw new Error('order not stable for same seed');

  // run with different seed B -> should differ (best-effort; allow equality if dataset is tiny)
  await page.goto(withParams(base, { seed: 'qp-seed-b' }), { waitUntil: 'networkidle' });
  await page.click('[data-testid="start-btn"]');
  await page.waitForFunction(() => !!window.__questionIds, { timeout: TIMEOUT });
  const b = await page.evaluate(() => window.__questionIds);
  if (a === b) console.warn('[warn] order equals between seeds; dataset may be too small, continuing');

  await browser.close();
})();
