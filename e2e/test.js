const { chromium } = require('playwright');
const fs = require('fs');
const TIMEOUT = 45000;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    await page.goto('http://localhost:8080/', {
      waitUntil: 'domcontentloaded',
      timeout: TIMEOUT,
    });
    await page.waitForResponse(
      (resp) => resp.url().endsWith('/build/dataset.json') && resp.ok(),
      { timeout: TIMEOUT }
    );

    await page.waitForSelector('#mode', { state: 'visible' });
    await page.waitForFunction(
      () => {
        const el = document.querySelector('#mode');
        return el && el.querySelectorAll('option').length >= 2;
      },
      { timeout: 30000 }
    );

    const values = await page.$$eval('#mode option', (opts) =>
      opts.map((o) => o.value || o.textContent.trim())
    );
    const wanted = ['multiple-choice', 'mc', 'choices', 'free', 'input'];
    const pick =
      wanted.find((w) => values.includes(w)) || values.find((v) => v) || null;
    if (!pick) {
      throw new Error(`No selectable option: got [${values.join(', ')}]`);
    }
    await page
      .selectOption('#mode', { value: pick })
      .catch(async () => {
        await page.selectOption('#mode', { label: pick });
      });

    await page.waitForSelector('#start-btn', {
      state: 'attached',
      timeout: TIMEOUT,
    });
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
  } catch (e) {
    await page
      .screenshot({ path: 'e2e-artifacts/failure.png', fullPage: true })
      .catch(() => {});
    const html = await page.content().catch(() => '');
    fs.mkdirSync('e2e-artifacts', { recursive: true });
    fs.writeFileSync('e2e-artifacts/dom.html', html);
    throw e;
  } finally {
    await browser.close();
  }
})();
