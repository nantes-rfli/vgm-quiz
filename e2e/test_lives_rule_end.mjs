// e2e/test_lives_rule_end.mjs
import { chromium } from 'playwright';

(async () => {
  const TIMEOUT = 30000;
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  const base = process.env.E2E_BASE_URL || process.env.APP_URL || 'http://127.0.0.1:8080/app/';
  const url = (() => {
    try {
      const u = new URL(base);
      const p = u.searchParams;
      if (!p.has('test')) p.set('test', '1');
      if (!p.has('mock')) p.set('mock', '1');
      p.set('lives', 'on');          // ← 3ミスで終了
      p.set('autostart', '0');
      return u.toString();
    } catch {
      return base + (base.includes('?')?'&':'?') + 'test=1&mock=1&lives=on&autostart=0';
    }
  })();

  await page.goto(url, { waitUntil: 'networkidle' });
  await page.click('[data-testid="start-btn"]');
  await page.waitForSelector('[data-testid="quiz-view"]', { state: 'visible', timeout: TIMEOUT });

  const answerWrongOnce = async () => {
    // Free/MC 両対応の不正解送出
    const isMC = await page.evaluate(() => {
      const el = document.querySelector('#choices');
      return !!el && getComputedStyle(el).display !== 'none';
    });
    if (isMC) {
      await page.waitForSelector('#choices button, .choice, [data-testid="choice"]', { timeout: TIMEOUT });
      // 正解インデックスを避けて1番目を押す（best-effort）
      await page.click('#choices button, .choice, [data-testid="choice"]');
    } else {
      await page.fill('#answer, [data-testid="answer"]', 'totally wrong');
      await page.click('#submit-btn, [data-testid="submit-btn"]');
    }
    await page.waitForSelector('#next-btn, [data-testid="next-btn"]', { state: 'visible', timeout: TIMEOUT });
    await page.click('#next-btn, [data-testid="next-btn"]');
  };

  // 3回わざと誤答 → ここで早期終了し、結果ビューが出る
  for (let i = 0; i < 3; i++) {
    await answerWrongOnce();
    const resultVisible = await page.$('#result-view[role="dialog"]');
    if (resultVisible) break;
  }

  await page.waitForSelector('#result-view[role="dialog"]', { state: 'visible', timeout: TIMEOUT });
  // lives 表示が 3/3 を含む（Misses: 3/3）
  const livesText = await page.evaluate(() => {
    const el = document.getElementById('lives') || document.querySelector('[data-testid="lives"]');
    return (el && el.textContent) || '';
  });
  if (!/3\s*\/\s*3/.test(livesText)) throw new Error('lives not reached 3/3');

  await browser.close();
})();
