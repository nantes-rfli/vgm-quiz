const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const TIMEOUT = 30000;
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // --- 必須クエリを“必ず”付ける（ベルト＆サスペンダー） ---
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

  await context.tracing.start({ screenshots: true, snapshots: true });
  await page.goto(url, { waitUntil: 'networkidle' });
  console.log('[E2E URL]', url);

  // Start → Quiz へ（autostart=0 前提）
  await page.waitForSelector('[data-testid="start-btn"]:not([disabled])', { state: 'visible', timeout: TIMEOUT });
  await page.click('[data-testid="start-btn"]');

  // Quiz 画面の表示
  await page.waitForSelector('[data-testid="quiz-view"]', { state: 'visible', timeout: TIMEOUT });

  // ------ ヘルパ ------
  const getText = async (sel) => (await page.$(sel)) ? (await page.textContent(sel)).trim() : null;
  const waitAnyChange = async (promptBefore) => {
    return Promise.race([
      page.waitForSelector('#next-btn, [data-testid="next-btn"]', { state: 'visible', timeout: TIMEOUT }),
      page.waitForSelector('#feedback:not(:empty), [data-testid="feedback"]:not(:empty)', { timeout: TIMEOUT }),
      page.waitForFunction((sel, prev) => {
        const el = document.querySelector(sel);
        return el && el.textContent && el.textContent.trim() !== (prev || '').trim();
      }, '[data-testid="prompt"]', promptBefore, { timeout: TIMEOUT }),
    ]);
  };
  const isMCVisible = async () => {
    return await page.evaluate(() => {
      const el = document.querySelector('#choices');
      return !!el && getComputedStyle(el).display !== 'none';
    });
  };
  const waitChoicesReady = async () => {
    await page.waitForFunction(() => {
      const btns = Array.from(document.querySelectorAll('#choices button, .choice, [data-testid="choice"]'));
      return btns.length >= 4 && btns.every(b => (b.textContent || '').trim().length > 0);
    }, { timeout: TIMEOUT });
  };
  const clickChoiceByIndex = async (idx) => {
    const sel = `#choices button:nth-of-type(${idx + 1}), .choice:nth-of-type(${idx + 1}), [data-testid="choice"]:nth-of-type(${idx + 1})`;
    await page.click(sel);
  };
  const answerQuestion = async ({ correct }) => {
    await page.waitForFunction(() => !!window.__expectedAnswer, { timeout: TIMEOUT });
    const expected = await page.evaluate(() => window.__expectedAnswer);
    const isMC = await isMCVisible();
    if (isMC) {
      await waitChoicesReady();
      const texts = await page.$$eval('#choices button, .choice, [data-testid="choice"]', btns => btns.map(b => b.textContent.trim()));
      let idx;
      if (correct) {
        idx = texts.findIndex(t => t === expected);
        if (idx < 0) idx = 0; // 保険
      } else {
        idx = texts.findIndex(t => t !== expected);
        if (idx < 0) idx = 0; // すべて同一なら先頭
      }
      await clickChoiceByIndex(idx);
    } else {
      if (correct) {
        await page.fill('[data-testid="answer"]', expected || 'test');
      } else {
        await page.fill('[data-testid="answer"]', 'this is surely wrong');
      }
      const submit = await page.$('[data-testid="submit-btn"], #submit-btn, [data-testid="submit"]');
      if (submit) await submit.click();
    }
  };
  const parseLives = async () => {
    const el = await page.$('[data-testid="lives"], #lives');
    if (!el) return null;
    const txt = (await el.textContent() || '').trim();
    const m = txt.match(/\d+/);
    if (m) return parseInt(m[0], 10);
    // ハート数え（♥/❤）
    const hearts = (txt.match(/\u2665|\u2764/g) || []).length;
    return hearts || null;
  };

  // 1問目：あえてミス → 状態変化（lives減少 or feedback or next）を観測
  const prompt0 = await getText('[data-testid="prompt"]');
  const lives0 = await parseLives();
  await answerQuestion({ correct: false });
  await waitAnyChange(prompt0);
  const lives1 = await parseLives();
  if (lives0 != null && lives1 != null) {
    console.log('[E2E] lives:', lives0, '->', lives1);
  }
  // 次へ（ボタンがあれば押す）
  const nextBtn = await page.$('#next-btn, [data-testid="next-btn"]');
  if (nextBtn) await nextBtn.click();

  // 2問目に遷移したことを確認（prompt 変化）
  await page.waitForFunction((sel, prev) => {
    const el = document.querySelector(sel);
    return el && el.textContent && el.textContent.trim() !== (prev || '').trim();
  }, '[data-testid="prompt"]', prompt0, { timeout: TIMEOUT });
  const prompt1 = await getText('[data-testid="prompt"]');
  console.log('[E2E] prompt0 -> prompt1:', prompt0, '=>', prompt1);

  // 2問目：正解で進める
  await answerQuestion({ correct: true });
  await waitAnyChange(prompt1);

  // タイマー観測（onなら減少を観測、offならスキップ）※可視は必須にしない
  try {
    const timerPresent = await page.$('[data-testid="timer"]');
    if (timerPresent) {
      const before = await getText('[data-testid="timer"]');
      await page.waitForTimeout(1200);
      const after = await getText('[data-testid="timer"]');
      if (before && after && before !== after) {
        console.log('[E2E] timer ticked:', before, '->', after);
      } else {
        console.log('[E2E] timer did not tick (likely off); present OK');
      }
    }
  } catch (e) {
    console.log('[E2E] timer check skipped:', e.message);
  }

  // スクショとDOM保存（常時）
  await page.screenshot({ path: 'final_test_js.png', fullPage: true });
  fs.writeFileSync('dom_test_js.html', await page.content());
  await context.tracing.stop({ path: 'trace_test_js.zip' });

  await browser.close();
})();

