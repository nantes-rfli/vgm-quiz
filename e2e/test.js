const { chromium } = require('playwright');
const fs = require('fs');
const TIMEOUT = 45000;

async function dumpArtifacts(page, prefix = 'failure') {
  try {
    fs.mkdirSync('e2e-artifacts', { recursive: true });
    await page
      .screenshot({ path: `e2e-artifacts/${prefix}.png`, fullPage: true })
      .catch(() => {});
    const html = await page.content().catch(() => '');
    fs.writeFileSync(`e2e-artifacts/${prefix}.html`, html);
  } catch (_) {}
}

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const page = await context.newPage();

  try {
    await page.goto(process.env.APP_URL || 'http://127.0.0.1:8080/app/', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await page.waitForResponse(
      (resp) => resp.url().endsWith('/build/dataset.json') && resp.ok(),
      { timeout: TIMEOUT }
    );

    try {
      await page.waitForSelector('#mode', { timeout: 10000 });
      await page.selectOption('#mode', { value: 'multiple-choice' }).catch(() => {});
    } catch (e) {
      await dumpArtifacts(page, 'mode-select');
      // continue even if mode selection fails
    }

    let started = false;
    try {
      await page.waitForSelector('#start', { state: 'visible', timeout: 30000 });
      await page.click('#start');
      started = true;
    } catch (_) {}

    if (!started) {
      const fallbacks = [
        'button:has-text("\u958b\u59cb")',
        'button:has-text("\u30b9\u30bf\u30fc\u30c8")',
        'button:has-text("Start")',
      ];
      for (const sel of fallbacks) {
        const btn = await page.$(sel);
        if (btn) {
          await btn.click();
          started = true;
          break;
        }
      }
    }

    if (!started) {
      await dumpArtifacts(page, 'start-not-found');
      throw new Error('Start control not found');
    }

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
    await dumpArtifacts(page);
    throw e;
  } finally {
    await browser.close();
  }
})();

