const { chromium } = require('playwright');

async function run() {
  const APP_URL = process.env.E2E_BASE_URL || process.env.APP_URL || 'https://nantes-rfli.github.io/vgm-quiz/app/';
  const url = `${APP_URL}?test=1&mock=1&lives=3&autostart=0`;
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded' });

  // Ensure the quiz is started if there's a start screen
  async function ensureStarted() {
    // If input already visible, we're good
    const maybeInput = page.locator('input[data-testid="answer"], input[type="text"], input[role="textbox"], [contenteditable="true"]').first();
    if (await maybeInput.isVisible().catch(() => false)) return;

    // Try to click a visible start-like button
    const btns = page.locator('button, [role="button"]');
    const n = await btns.count();
    const re = /start|begin|play|go|quiz|開始|スタート|はじめる/i;
    for (let i = 0; i < n; i++) {
      const b = btns.nth(i);
      if (!(await b.isVisible().catch(() => false))) continue;
      const txt = (await b.innerText().catch(() => '')).trim();
      if (re.test(txt)) {
        await b.click().catch(() => {});
        await page.waitForTimeout(400);
        break;
      }
    }

    // Fallback: press Enter to start
    await page.keyboard.press('Enter').catch(() => {});
    await page.waitForTimeout(400);
  }

  await ensureStarted();

  // Try to find an answer input in a generic way (after starting)
  const input = await page.locator('input[data-testid="answer"], input[type="text"], input[role="textbox"], [contenteditable="true"]').first();
  await input.waitFor({ state: 'visible', timeout: 8000 });

  // Submit 3 obviously wrong answers. We keep this generic to avoid tight UI coupling.
  for (let i = 0; i < 3; i++) {
    await input.fill(`totally-wrong-${i}`);
    await page.keyboard.press('Enter');
    // small delay for state update
    await page.waitForTimeout(500);
  }

  // Expect a result modal or game-over indicator to exist after lives exhaust.
  // We check for a dialog role or common game-over keywords.
  const gotDialog = await page.locator('[role="dialog"]').first().isVisible().catch(() => false);
  const bodyText = (await page.locator('body').innerText().catch(() => '')) || '';
  if (!gotDialog && !/game over|結果|スコア|summary/i.test(bodyText)) {
    throw new Error('lives test did not detect game-over state after 3 wrong answers');
  }

  await browser.close();
  console.log('[E2E lives] PASS');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
