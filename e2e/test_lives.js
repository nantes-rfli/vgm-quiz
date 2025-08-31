const { chromium } = require('playwright');

async function run() {
  const APP_URL = process.env.E2E_BASE_URL || process.env.APP_URL || 'https://nantes-rfli.github.io/vgm-quiz/app/';
  const url = `${APP_URL}?test=1&mock=1&lives=3&autostart=0`;
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded' });

  // Try to find an answer input in a generic way
  const input = await page.locator('input[type="text"], input[role="textbox"], [contenteditable="true"]').first();
  await input.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});

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
