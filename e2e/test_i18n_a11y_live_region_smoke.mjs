import { chromium } from 'playwright';

(async () => {
  const TIMEOUT = 30000;
  const browser = await chromium.launch();
  const page = await browser.newPage();

  function urlWith(base, lang) {
    const u = new URL(base);
    const p = u.searchParams;
    p.set('test', '1');
    p.set('mock', '1');
    p.set('daily', '2000-01-01'); // 1問で結果へ
    p.set('autostart', '0');
    p.set('lang', lang);
    return u.toString();
  }

  function defaultBase() {
    const repo = process.env.GITHUB_REPOSITORY;
    if (repo) {
      const [owner, name] = repo.split('/');
      return `https://${owner}.github.io/${name}/app/`;
    }
    return 'http://127.0.0.1:8080/app/';
  }

  const base = process.env.E2E_BASE_URL || process.env.APP_URL || defaultBase();

  // ---- JA ----
  await page.goto(urlWith(base, 'ja'));
  await page.waitForFunction(() => document.documentElement.lang === 'ja', null, { timeout: TIMEOUT });
  const liveStartJa = await page.textContent('#feedback');
  if (!liveStartJa || !/準備OK/.test(liveStartJa)) {
    throw new Error(`JA live region not ready: "${liveStartJa}"`);
  }
  // Start the quiz (ensure the button is visible before clicking)
  await page.waitForSelector('[data-testid="start-btn"]', { state: 'visible', timeout: TIMEOUT });
  await page.click('[data-testid="start-btn"]');

  // Choices can exist immediately but be mid-transition and not "visible" per Playwright.
  // Be robust: wait for attachment, prefer visible click, then fall back to force click.
  await page.waitForSelector('#choices button', { state: 'attached', timeout: TIMEOUT });
  const choice = (await page.$$('#choices button'))[0];
  if (!choice) throw new Error('No choice button found');
  try {
    await page.waitForSelector('#choices button', { state: 'visible', timeout: 3000 });
    await choice.click();
  } catch {
    await choice.click({ force: true });
  }
  await page.waitForSelector('#result-view[role="dialog"]', { state: 'visible', timeout: TIMEOUT });
  const liveOpenedJa = await page.textContent('#feedback');
  if (!/結果/.test(liveOpenedJa || '')) {
    throw new Error(`JA live region did not announce results: "${liveOpenedJa}"`);
  }
  await page.keyboard.press('Escape');
  await page.waitForSelector('[data-testid="start-btn"]', { state: 'visible', timeout: TIMEOUT });
  const liveReadyAgainJa = await page.textContent('#feedback');
  if (!/準備OK/.test(liveReadyAgainJa || '')) {
    throw new Error(`JA live region not reset: "${liveReadyAgainJa}"`);
  }

  // ---- EN ----
  await page.goto(urlWith(base, 'en'));
  await page.waitForFunction(() => document.documentElement.lang === 'en', null, { timeout: TIMEOUT });
  const liveStartEn = await page.textContent('#feedback');
  if (!/Ready/i.test(liveStartEn || '')) {
    throw new Error(`EN live region not ready: "${liveStartEn}"`);
  }

  await browser.close();
})();

