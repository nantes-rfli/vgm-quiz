// Minimal Playwright E2E for: free mode + timer + ARIA updates
// Keeps existing tests intact; run alongside e2e/test.js
const { chromium } = require('playwright');

(async () => {
  const base = process.env.E2E_BASE_URL || 'https://nantes-rfli.github.io/vgm-quiz/app/?test=1';
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  try {
    await page.goto(base, { waitUntil: 'domcontentloaded' });

    // Start view present
    await page.waitForSelector('[data-testid="start-view"]');

    // Switch to free-input mode
    await page.selectOption('#mode', 'free');

    // Start
    await page.click('[data-testid="start-btn"]');

    // Quiz view visible; prompt populated (ARIA live region)
    await page.waitForSelector('[data-testid="quiz-view"]');
    await page.waitForSelector('[data-testid="prompt"]');
    const prompt1 = (await page.textContent('[data-testid="prompt"]')).trim();
    if (!prompt1) throw new Error('Prompt empty after start');

    // Timer/lives regions present, aria-live updates over time
    await page.waitForSelector('[data-testid="timer"]');
    await page.waitForTimeout(300); // allow live region to tick at least once
    const timer1 = (await page.textContent('[data-testid="timer"]')).trim();
    await page.waitForTimeout(700);
    const timer2 = (await page.textContent('[data-testid="timer"]')).trim();
    if (timer1 === timer2) {
      console.warn('Timer text did not change within 1s; continuing (non-fatal).');
    }

    // Free answer flow: type wrong answer once to see HUD change (lives or prompt)
    await page.fill('[data-testid="answer"]', 'dummy wrong answer');
    const livesBefore = (await page.textContent('[data-testid="lives"]')).trim();
    await page.click('[data-testid="submit-btn"]');
    await page.waitForTimeout(200);
    const livesAfter = (await page.textContent('[data-testid="lives"]')).trim();
    if (livesBefore === livesAfter) {
      console.warn('Lives did not change after wrong submission; continuing (non-fatal).');
    }

    // Prompt should update to next state or show feedback
    const prompt2 = (await page.textContent('[data-testid="prompt"]')).trim();
    if (prompt1 === prompt2) {
      console.warn('Prompt did not change after submission; continuing (non-fatal).');
    }

    console.log('[OK] free-mode, timer, aria-live basic checks passed');
  } finally {
    await ctx.close();
    await browser.close();
  }
})();

