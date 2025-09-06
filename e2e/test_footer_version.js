// Standalone footer format check (CommonJS). Run with: node e2e/test_footer_version.js
const { chromium } = require('playwright');

(async () => {
  const base =
    process.env.E2E_BASE_URL ||
    'https://nantes-rfli.github.io/vgm-quiz/app/?test=1&mock=1&seed=e2e&autostart=0';

  const url = new URL(base);
  const ensure = (k, v) => { if (!url.searchParams.has(k)) url.searchParams.set(k, v); };
  ensure('test', '1'); ensure('mock', '1'); ensure('seed', 'e2e'); ensure('autostart', '0');

  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  try {
    console.log('[footer-version check] URL:', url.toString());
    await page.goto(url.toString(), { waitUntil: 'domcontentloaded', timeout: 20000 });
    // Wait for the footer element to exist
    const sel = '#version, #footer-version, footer .version, footer#version, footer [data-testid="footer-version"]';
    await page.waitForSelector(sel, { timeout: 8000 });
    // Wait until the footer text becomes non-empty (loadVersion runs on DOMContentLoaded)
    await page.waitForFunction((s) => {
      const el = document.querySelector(s);
      return !!(el && el.textContent && el.textContent.trim().length > 0);
    }, sel, { timeout: 8000 });

    const el = await page.$(sel);
    const text = (await el.textContent() || '').trim();
    console.log('[footer-version]', text);
    if (!text) throw new Error('footer text empty');

    // Expected formats (with or without "updated"):
    // Dataset: <dataset> • commit: <abcdef0|local> • updated: YYYY-MM-DD HH:MM
    // Dataset: <dataset> • commit: <abcdef0|local>
    const re = /^Dataset:\s+(.+?)\s+•\s+commit:\s+([0-9a-f]{7}|local)(?:\s+•\s+updated:\s+(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}))?$/i;
    const m = text.match(re);
    if (!m) throw new Error('footer text format mismatch');

    const ds = m[1];
    const commit = m[2];
    if (!ds || !ds.trim()) throw new Error('dataset empty');
    if (commit !== 'local' && !/^[0-9a-f]{7}$/.test(commit)) {
      throw new Error(`commit not short 7: ${commit}`);
    }
    console.log('[OK] footer format looks good');
  } catch (err) {
    console.error('[NG] footer check failed:', err?.message || err);
    try {
      const fs = require('fs');
      fs.mkdirSync('e2e/screenshots', { recursive: true });
      await page.screenshot({ path: 'e2e/screenshots/footer.png', fullPage: true });
      const html = await page.content();
      fs.writeFileSync('e2e/screenshots/footer.html', html);
    } catch (_) {}
    process.exitCode = 1;
  } finally {
    await ctx.close().catch(() => {});
    await browser.close().catch(() => {});
  }
})();
