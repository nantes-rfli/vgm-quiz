// e2e/test_daily_mode.mjs
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
      if (!p.has('qp'))   p.set('qp', '1');
      p.set('daily', '2000-01-01');  // daily.json に用意した固定日
      p.set('autostart', '0');
      return u.toString();
    } catch {
      return base + (base.includes('?') ? '&' : '?') + 'test=1&mock=1&qp=1&daily=2000-01-01&autostart=0';
    }
  })();

  await page.goto(url, { waitUntil: 'networkidle' });
  await page.click('[data-testid="start-btn"]');
  await page.waitForSelector('[data-testid="quiz-view"]', { state: 'visible', timeout: TIMEOUT });

  // Freeモード前提で1問を誤答→Next→結果が /1 になること
  const hasFree = await page.$('#answer, [data-testid="answer"]');
  if (hasFree) {
    await page.fill('#answer, [data-testid="answer"]', 'totally wrong');
    await page.click('#submit-btn, [data-testid="submit-btn"]');
  } else {
    // MC の場合は1番目を選んで不正解にする（best-effort）
    await page.click('#choices button:nth-of-type(1), .choice:nth-of-type(1), [data-testid="choice"]:nth-of-type(1)');
  }
  await page.click('#next-btn, [data-testid="next-btn"]');
  await page.waitForSelector('#result-view', { state: 'visible', timeout: TIMEOUT });

  const final = await page.textContent('#final-score');
  if (!/\/\s*1\b/.test(final || '')) {
    throw new Error(`final score is not */1: got "${final}"`);
  }

  await browser.close();
})();
