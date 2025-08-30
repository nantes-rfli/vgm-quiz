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
      if (!p.has('test'))      p.set('test', '1');
      if (!p.has('mock'))      p.set('mock', '1');
      if (!p.has('seed'))      p.set('seed', 'e2e');
      if (!p.has('autostart')) p.set('autostart', '0');
      return u.toString();
    } catch {
      return base + (base.includes('?') ? '&' : '?') + 'test=1&mock=1&seed=e2e&autostart=0';
    }
  })();

  await page.goto(url, { waitUntil: 'networkidle' });
  await page.click('[data-testid="start-btn"]');
  await page.waitForSelector('[data-testid="quiz-view"]', { state: 'visible', timeout: TIMEOUT });

  // 1問目：わざと不正解にする
  await page.waitForFunction(() => !!window.__expectedAnswer, { timeout: TIMEOUT });
  const expected = await page.evaluate(() => window.__expectedAnswer);

  // MC があれば別の選択肢をクリック、Free なら適当な誤答を入れて Submit
  const isMC = await page.evaluate(() => {
    const el = document.querySelector('#choices');
    return !!el && getComputedStyle(el).display !== 'none';
  });
  if (isMC) {
    const choices = await page.$$eval('#choices button,.choice,[data-testid="choice"]', els => els.map(e => (e.textContent || '').trim()));
    const wrongIdx = Math.max(0, choices.findIndex(t => t.toLowerCase() !== String(window.__expectedAnswer || '').toLowerCase()));
    await page.click(`#choices button:nth-of-type(${wrongIdx + 1}), .choice:nth-of-type(${wrongIdx + 1}), [data-testid="choice"]:nth-of-type(${wrongIdx + 1})`);
  } else {
    await page.fill('#answer, [data-testid="answer"]', 'totally wrong');
    await page.click('#submit-btn, [data-testid="submit-btn"]');
  }
  await page.click('#next-btn, [data-testid="next-btn"]');

  // lives のテキストが "1/3" 相当を含むか（言語差異を避けて数字だけ検査）
  await page.waitForFunction(() => {
    const el = document.getElementById('lives') || document.querySelector('[data-testid="lives"]');
    if (!el) return false;
    const t = (el.textContent || '').replace(/\s+/g,'');
    // "1/3" や "Misses:1/3" 等
    return /(?:^|[^0-9])1\s*\/\s*3(?:[^0-9]|$)/.test(t);
  }, { timeout: TIMEOUT });

  await browser.close();
})();

