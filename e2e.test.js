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
  const page = await browser.newPage();

  try {
    await page.goto(process.env.APP_URL || 'http://127.0.0.1:8080/app/', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    // --- UI–E2E contract: #mode must have exactly the canonical options ---
    try {
      await page.waitForSelector('#mode', { timeout: 10000 });
      const values = await page.$$eval('#mode option', (opts) =>
        opts.map((o) => o.value || o.textContent.trim())
      );
      const required = ['multiple-choice', 'free'];
      const missing = required.filter((r) => !values.includes(r));
      if (missing.length) {
        throw new Error(`[E2E] Missing #mode options: ${missing.join(', ')}`);
      }
    } catch (err) {
      await dumpArtifacts(page, 'mode-contract');
      throw err;
    }
    // ----------------------------------------------------------------------

    await page.waitForResponse(
      (resp) => resp.url().endsWith('/build/dataset.json') && resp.ok(),
      { timeout: TIMEOUT }
    );
    let picked = false;
    try {
      const hasMode = await page.$('#mode');
      if (hasMode) {
        await page
          .waitForSelector('#mode', { state: 'visible', timeout: 5000 })
          .catch(() => {});
        const values = await page.$$eval('#mode option', (opts) =>
          opts.map((o) => o.value || o.textContent.trim())
        );
        if (values.length > 0) {
          const wanted = ['multiple-choice', 'free'];
          const pick = wanted.find((w) => values.includes(w)) || values[0];
          await page
            .selectOption('#mode', { value: pick })
            .catch(async () => {
              await page
                .selectOption('#mode', { label: pick })
                .catch(() => {});
            });
          picked = true;
        }
      }
    } catch (e) {
      await dumpArtifacts(page, 'mode-select');
      // continue even if mode selection fails
    }

    // Be tolerant: #start might appear slightly late on CI
    try {
      await page.waitForSelector('#start', { state: 'visible', timeout: 20000 });
    } catch {
      // one soft retry after a small settle time, with artifact if still failing
      await page.waitForTimeout(1000);
      try {
        await page.waitForSelector('#start', { state: 'visible', timeout: 10000 });
      } catch (e) {
        await dumpArtifacts(page, 'start-visible');
        throw e;
      }
    }
    await page.click('#start');

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

