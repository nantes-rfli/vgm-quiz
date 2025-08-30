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
    // Free/MC 両対応の“不正解”を必ず送出し、回答後は「Result or Next」を先に待つ
    const isMC = await page.evaluate(() => {
      const el = document.querySelector('#choices');
      return !!el && getComputedStyle(el).display !== 'none';
    });
    if (isMC) {
      await page.waitForSelector('#choices button, .choice, [data-testid="choice"]', { timeout: TIMEOUT });
      // 正解テキスト（__expectedAnswer）を取得し、それ以外のボタンをクリック
      const expected = await page.evaluate(() => window.__expectedAnswer || '');
      const wrongIdx = await page.$$eval(
        '#choices button, .choice, [data-testid="choice"]',
        (els, expected) => {
          const e = String(expected || '').trim().toLowerCase();
          for (let i = 0; i < els.length; i++) {
            const t = (els[i].textContent || '').trim().toLowerCase();
            if (t && t !== e) return i;
          }
          return 0; // 全部同じ等の異常系は先頭にフォールバック
        },
        expected
      );
      await page.click(`#choices button:nth-of-type(${wrongIdx + 1}), .choice:nth-of-type(${wrongIdx + 1}), [data-testid="choice"]:nth-of-type(${wrongIdx + 1})`);
    } else {
      await page.fill('#answer, [data-testid="answer"]', 'totally wrong');
      await page.click('#submit-btn, [data-testid="submit-btn"]');
    }
    // 回答後、まずはリザルトが出たかを短めに確認 → 出ていれば終了
    const resQuick = await page.waitForSelector('#result-view[role="dialog"]', { state: 'visible', timeout: 1500 }).catch(() => null);
    if (resQuick) return true;
    // まだ出ていなければ Next で遷移
    const nextBtn = await page.waitForSelector('#next-btn, [data-testid="next-btn"]', { state: 'visible', timeout: TIMEOUT });
    await nextBtn.click();
    // 遷移後にもリザルト出現をチェック（早期終了の取りこぼし防止）
    const resAfter = await page.waitForSelector('#result-view[role="dialog"]', { state: 'visible', timeout: 1500 }).catch(() => null);
    return !!resAfter;
  };

  // 3回わざと誤答 → ここで早期終了し、結果ビューが出る
  for (let i = 0; i < 3; i++) {
    const ended = await answerWrongOnce();
    if (ended) break;
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
