import { chromium } from 'playwright';

(async () => {
  const TIMEOUT = 30000;
  const browser = await chromium.launch();
  const page = await browser.newPage();
  // Reduce motion in CI to avoid transient visibility/actionability issues
  try { await page.emulateMedia({ reducedMotion: 'reduce' }); } catch {}

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
  // Start が disabled のままなら、最大30sまで有効化を待ってからクリック
  await page.waitForSelector('#start-btn:not([disabled])', { timeout: 30000 });
  await page.click('[data-testid="start-btn"]');

  // Choices can exist immediately but be mid-transition / off-visibility.
  // Prefer a programmatic click first to bypass actionability, then fall back to Locator.
  await page.waitForSelector('#choices button', { state: 'attached', timeout: TIMEOUT });
  // small delay to let any intro animation settle
  await page.waitForTimeout(500);
  let clicked = false;
  try {
    await page.$eval('#choices button', (el) => el && el.click());
    clicked = true;
  } catch {}
  if (!clicked) {
    const choiceLoc = page.locator('#choices button').first();
    try {
      await choiceLoc.waitFor({ state: 'visible', timeout: 3000 });
      await choiceLoc.click();
      clicked = true;
    } catch {
      try {
        await choiceLoc.click({ force: true });
        clicked = true;
      } catch {}
    }
  }
  if (!clicked) {
    throw new Error('Failed to click a choice via all strategies');
  }
  // --- Robust path to reach result dialog ---
  // Purpose of this test: i18n + a11y live region readiness, and ability to reach the final result dialog.
  // Some locales (e.g., JA) can yield >1 question under ?daily during mock/test. Progress deterministically.
  const resultDlg = page.locator('#result-view[role="dialog"]');
  const firstChoice = page.locator('#choices button').first();
  const nextBtn = page.locator('#next-btn');

  // Try up to 6 steps: check result → answer if needed → press Next if possible.
  let reached = false;
  for (let step = 0; step < 6; step++) {
    try {
      await resultDlg.waitFor({ state: 'visible', timeout: 1200 });
      reached = true;
      break;
    } catch {
      if (await firstChoice.isVisible()) {
        await firstChoice.click();
      }
      if (await nextBtn.isVisible()) {
        await nextBtn.click();
      }
    }
  }
  if (!reached) {
    throw new Error('result-view not visible after advancing through questions');
  }
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

