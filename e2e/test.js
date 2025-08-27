const { chromium, expect } = require('playwright'); // if using @playwright/test adapt accordingly
const TIMEOUT = 45000;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // 1) open and wait for dataset to load
  await page.goto('http://localhost:8080/app/', { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
  await page.waitForResponse(
    (resp) => resp.url().endsWith('/build/dataset.json') && resp.ok(),
    { timeout: TIMEOUT }
  );

  // 2) select options if they exist
  if ((await page.$('#question-types')) !== null) {
    // keep only one type checked (title->game), if checkboxes exist
    const boxes = await page.$$('#question-types input[type=checkbox]');
    for (let i = 0; i < boxes.length; i++) {
      // uncheck all first
      const checked = await boxes[i].isChecked().catch(() => false);
      if (checked) await boxes[i].click();
    }
    const first = await page.$('#question-types input[type=checkbox]');
    if (first) await first.click();
  }
  if ((await page.$('#num-questions')) !== null) {
    await page.selectOption('#num-questions', { value: '5' }).catch(() => {});
  }

  // 3) click Start when it becomes enabled
  await page.waitForSelector('#start', { state: 'attached', timeout: TIMEOUT });
  await page.waitForFunction(
    () => {
      const b = document.querySelector('#start');
      return b && !b.disabled;
    },
    { timeout: TIMEOUT }
  );
  await page.click('#start');

  // 4) robust visible wait for prompt (not hidden & not display:none)
  await page.waitForFunction(
    () => {
      const el = document.querySelector('#prompt');
      if (!el) return false;
      const style = window.getComputedStyle(el);
      return (
        !el.hasAttribute('hidden') &&
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        el.textContent.trim().length > 0
      );
    },
    { timeout: TIMEOUT }
  );

  // 5) answer once (use exact answer from DOM if available to guarantee success)
  const correct = await page.evaluate(() => {
    // If app exposes current expected answer, prefer that; otherwise fall back
    return window.__expectedAnswer || null;
  });
  const answer = correct || 'UNDERTALE'; // fallback: adjust to your dataset
  await page.fill('#answer', answer);
  await page.click('#submit');

  // 6) assert score updated (>= 1)
  await page.waitForSelector('#score', { timeout: TIMEOUT });
  const scoreTxt = await page.textContent('#score');
  if (!/\b1\b/.test(scoreTxt)) {
    throw new Error('Score did not increase after correct answer: ' + scoreTxt);
  }

  await browser.close();
})();

