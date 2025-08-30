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
    await page.goto(url.toString(), { waitUntil: 'domcontentloaded' });

    // footer テキストの取得（#footer-version / #version / .version いずれか）
    const loc = page.locator('#footer-version, #version, footer .version').first();
    await loc.waitFor({ state: 'visible', timeout: 10000 });
    const text = (await loc.textContent() || '').trim();
    console.log('[footer-version]', text);

    // 許容: Dataset は vN or 英数、commit は local or 7桁HEX、updated は任意
    const re = /^Dataset:\s+(v\d+|[A-Za-z0-9._-]+)\s+•\s+commit:\s+(local|[0-9a-f]{7})(?:\s+•\s+updated:\s+\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})?$/;
    const m = text.match(re);
    if (!m) throw new Error('footer text format mismatch');

    const commit = m[2];
    if (commit !== 'local' && !/^[0-9a-f]{7}$/.test(commit)) {
      throw new Error(`commit not short 7: ${commit}`);
    }

    console.log('[OK] footer format looks good');
  } catch (err) {
    console.error('[NG] footer check failed:', err?.message || err);
    process.exitCode = 1;
  } finally {
    await ctx.close().catch(() => {});
    await browser.close().catch(() => {});
  }
})();

