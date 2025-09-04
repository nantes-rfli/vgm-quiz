import { chromium } from 'playwright';

(async () => {
  const TIMEOUT = 30000;
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const base = process.env.E2E_BASE_URL || process.env.APP_URL || 'http://127.0.0.1:8080/app/';
  const url = (() => {
    const u = new URL(base);
    const p = u.searchParams;
    p.set('test', '1');
    p.set('mock', '1');
    // daily=2000-01-01 -> dataset with 1 question (auto finish quicker)
    p.set('daily', '2000-01-01');
    // autostart 0 to press start; flows are consistent with other tests
    p.set('autostart', '0');
    return u.toString();
  })();

  await page.goto(url);
  await page.waitForSelector('[data-testid="start-btn"]', { state: 'visible', timeout: TIMEOUT });
  await page.click('[data-testid="start-btn"]');

  // Answer the single daily question quickly by pressing first choice twice (confirm submit if needed)
  await page.waitForSelector('#choices button', { state: 'visible', timeout: TIMEOUT });
  const firstChoice = (await page.$$('#choices button'))[0];
  await firstChoice.click();
  // If there is a confirm step, try to click "Next" or similar; otherwise wait for result dialog
  // We race the result dialog appearance.
  await page.waitForSelector('[data-testid="result-dialog"], #result-view[role="dialog"]', { state: 'visible', timeout: TIMEOUT });

  // Check inert & aria-hidden applied to background
  const bgState = await page.evaluate(() => {
    const dlg = document.getElementById('result-view');
    const main = document.getElementById('main') || dlg.parentElement;
    const siblings = Array.from(main.children).filter(el => el !== dlg);
    const inertAll = siblings.every(el => el.hasAttribute('inert'));
    const ariaHiddenAll = siblings.every(el => el.getAttribute('aria-hidden') === 'true');
    const bodyOverflowHidden = (document.body && getComputedStyle(document.body).overflow) === 'hidden';
    return { inertAll, ariaHiddenAll, bodyOverflowHidden };
  });
  if (!bgState.inertAll) throw new Error('Background siblings are not inert');
  if (!bgState.ariaHiddenAll) throw new Error('Background siblings are not aria-hidden');
  if (!bgState.bodyOverflowHidden) throw new Error('Body scroll was not locked');

  // Try clicking a background control (should be inert and not trigger navigation)
  // For robustness, attempt to click History button if present; this should have no effect.
  const hadHistory = await page.$('#history-btn') !== null;
  if (hadHistory) {
    await page.click('#history-btn').catch(() => {}); // should be ignored due to inert
    // The dialog should remain visible
    await page.waitForSelector('[data-testid="result-dialog"], #result-view[role="dialog"]', { state: 'visible', timeout: TIMEOUT });
  }

  // Close with Escape and verify inert cleanup and start focus visible again
  await page.keyboard.press('Escape');
  await page.waitForSelector('[data-testid="start-btn"]', { state: 'visible', timeout: TIMEOUT });

  const cleaned = await page.evaluate(() => {
    const dlg = document.getElementById('result-view');
    const main = document.getElementById('main') || dlg.parentElement;
    const siblings = Array.from(main.children).filter(el => el !== dlg);
    const inertGone = siblings.every(el => !el.hasAttribute('inert'));
    const ariaHiddenGone = siblings.every(el => !el.hasAttribute('aria-hidden'));
    const bodyOverflow = (document.body && getComputedStyle(document.body).overflow);
    return { inertGone, ariaHiddenGone, bodyOverflow };
  });
  if (!cleaned.inertGone) throw new Error('inert attribute remained after closing dialog');
  if (!cleaned.ariaHiddenGone) throw new Error('aria-hidden remained after closing dialog');
  if (cleaned.bodyOverflow === 'hidden') throw new Error('Body scroll lock not removed');

  await browser.close();
})();

