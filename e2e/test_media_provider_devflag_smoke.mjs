// e2e/test_media_provider_devflag_smoke.mjs
// Verify that dev flag ?provider=apple|youtube forces the branch and stubs render under ?test=1.
import { chromium } from 'playwright';

(async () => {
  const TIMEOUT = 30000;
  const base = process.env.E2E_BASE_URL || process.env.APP_URL || 'http://127.0.0.1:8080/app/';
  const browser = await chromium.launch();
  const page = await browser.newPage();

  async function checkProvider(p) {
    const url = (() => {
      const u = new URL(base);
      const sp = u.searchParams;
      sp.set('test','1');
      sp.set('mock','1');
      sp.set('autostart','1');
      sp.set('provider', p);
      return u.toString();
    })();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
    // Wait for media root/stub to appear
    await page.waitForSelector('#media-root', { timeout: TIMEOUT });
    const provider = await page.getAttribute('#media-root', 'data-provider');
    if (provider !== p) {
      throw new Error(`expected data-provider="${p}", got "${provider}" @ ${url}`);
    }
    await page.waitForSelector('#media-stub', { timeout: TIMEOUT });
  }

  await checkProvider('apple');
  await checkProvider('youtube');
  await browser.close();
  console.log('[ok] media provider devflag smoke');
})().catch(e => { console.error(e); process.exit(1); });
