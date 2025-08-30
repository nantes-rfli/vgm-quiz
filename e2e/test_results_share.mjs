// 結果画面に「結果をコピー」ボタンが表示され、クリックでクリップボードへ書けることを確認
import { chromium } from 'playwright';
import fs from 'fs';

(async () => {
  const TIMEOUT = 30000;
  const browser = await chromium.launch();
  const context = await browser.newContext();
  // クリップボード権限を付与（ヘッドレスで必要）
  await context.grantPermissions(['clipboard-read','clipboard-write']);
  const page = await context.newPage();

  // 既存E2Eと同様にクエリを補完
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

  // Start → Quiz
  await page.waitForSelector('[data-testid="start-btn"]:not([disabled])', { state: 'visible', timeout: TIMEOUT });
  await page.click('[data-testid="start-btn"]');
  await page.waitForSelector('[data-testid="quiz-view"]', { state: 'visible', timeout: TIMEOUT });

  // helper: MC なら選択肢から __expectedAnswer を選んで即回答、Free なら入力して Submit
  const isMC = async () => await page.evaluate(() => {
    const el = document.querySelector('#choices');
    return !!el && getComputedStyle(el).display !== 'none';
  });
  const answerOnce = async () => {
    await page.waitForFunction(() => !!window.__expectedAnswer, { timeout: TIMEOUT });
    const expected = await page.evaluate(() => window.__expectedAnswer);
    if (await isMC()) {
      await page.waitForFunction(() => {
        const btns = Array.from(document.querySelectorAll('#choices button,.choice,[data-testid="choice"]'));
        return btns.length >= 4 && btns.every(b => (b.textContent || '').trim().length > 0);
      }, { timeout: TIMEOUT });
      const idx = await page.$$eval('#choices button,.choice,[data-testid="choice"]',
        (btns, expected) => btns.findIndex(b => (b.textContent || '').trim().toLowerCase() === String(expected).trim().toLowerCase()), expected);
      const clickSel = `#choices button:nth-of-type(${idx + 1}), .choice:nth-of-type(${idx + 1}), [data-testid="choice"]:nth-of-type(${idx + 1})`;
      await page.click(clickSel);
    } else {
      await page.fill('#answer, [data-testid="answer"]', expected);
      await page.click('#submit-btn, [data-testid="submit-btn"]');
    }
    await page.waitForSelector('#next-btn, [data-testid="next-btn"]', { state: 'visible', timeout: TIMEOUT });
    await page.click('#next-btn, [data-testid="next-btn"]');
  };

  // 5問（既定値）を連続で正解し、結果画面へ
  for (let i = 0; i < 5; i++) { await answerOnce(); }
  await page.waitForSelector('#result-view', { state: 'visible', timeout: TIMEOUT });

  // コピー -> クリップボードに "Score:" を含むことを検証
  await page.click('#copy-result-btn, [data-testid="copy-result-btn"]', { timeout: TIMEOUT });
  const clip = await page.evaluate(async () => (await navigator.clipboard.readText?.()) || '');
  if (!clip.includes('Score:')) throw new Error('clipboard does not contain "Score:"');

  // アーティファクト
  await page.screenshot({ path: 'artifacts/final_test_share.png', fullPage: true });
  fs.writeFileSync('artifacts/dom_test_share.html', await page.content());

  await browser.close();
})();
