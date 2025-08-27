const { chromium } = require('playwright');
const TIMEOUT = 45000;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto('http://localhost:8080/', { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
  await page.waitForResponse(
    (resp) => resp.url().endsWith('/build/dataset.json') && resp.ok(),
    { timeout: TIMEOUT }
  );

  await page.selectOption('#mode', { value: 'mc' });

  await page.waitForSelector('#start-btn', { state: 'attached', timeout: TIMEOUT });
  await page.waitForFunction(
    () => {
      const b = document.querySelector('#start-btn');
      return b && !b.disabled;
    },
    { timeout: TIMEOUT }
  );
  await page.click('#start-btn');

  await page.waitForFunction(
    () => {
      const first = document.querySelector('#choices button');
      return first && first.textContent.trim() === window.__expectedAnswer;
    },
    { timeout: TIMEOUT }
  );

  await page.click('#choices button');

  await page.waitForFunction(
    () => /Score: 1/.test(document.getElementById('score-bar').textContent),
    { timeout: TIMEOUT }
  );

  await browser.close();
})();
