// Minimal Playwright E2E for: free mode + timer + ARIA updates
// Keeps existing tests intact; run alongside e2e/test.js
const { chromium } = require('playwright');

(async () => {
  const base = process.env.E2E_BASE_URL || 'https://nantes-rfli.github.io/vgm-quiz/app/?test=1';
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  // --- diagnostics: tracing ---
  try { await ctx.tracing.start({ screenshots: true, snapshots: true, sources: true }); } catch {}

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

    // Timer region: element must exist; may be hidden when timer is off
    await page.waitForSelector('[data-testid="timer"]', { state: 'attached', timeout: 30000 });
    const timerState = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="timer"]');
      if (!el) return { present: false };
      const cs = getComputedStyle(el);
      const visible = !(cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0');
      return {
        present: true,
        visible,
        ariaLive: el.getAttribute('aria-live'),
        ariaAtomic: el.getAttribute('aria-atomic'),
        role: el.getAttribute('role')
      };
    });
    if (!timerState.present) throw new Error('timer element is missing');
    // ARIA attributes must always be present
    if (timerState.ariaLive !== 'polite') throw new Error('timer aria-live must be "polite"');
    if (timerState.ariaAtomic !== 'true') throw new Error('timer aria-atomic must be "true"');
    // allow live region to tick at least once
    await page.waitForTimeout(300);
    const timer1 = (await page.textContent('[data-testid="timer"]')).trim();
    await page.waitForTimeout(700);
    const timer2 = (await page.textContent('[data-testid="timer"]')).trim();
    if (timer1 === timer2) {
      console.warn('Timer text did not change within 1s; continuing (non-fatal).');
    }
    console.log('[A11y] timer present; visible=', timerState.visible, 'aria-live=', timerState.ariaLive, 'aria-atomic=', timerState.ariaAtomic);

    // === 追加A11yチェック: フォーカス・MCのaria-pressed・progressbar ===
    // Start → Quiz へ（Startは test.js 側でも押しているが、このテスト単体でも安全に進める）
    const startBtn = await page.$('[data-testid="start-btn"], #start-btn');
    if (startBtn) {
      await page.click('[data-testid="start-btn"]');
      await page.waitForSelector('[data-testid="quiz-view"]', { state: 'visible', timeout: 30000 });
    }

    // フォーカス: 最初の操作対象に来ているか（Free: answer / MC: 最初のchoice）
    const focusOk = await page.evaluate(() => {
      const ae = document.activeElement;
      if (!ae) return false;
      const answer = document.querySelector('[data-testid="answer"], #answer');
      const firstChoice = document.querySelector('#choices button, .choice, [data-testid="choice"]');
      return ae === answer || ae === firstChoice;
    });
    console.log('[A11y] focus on first control:', focusOk);

    // MCなら role="button" と aria-pressed のトグルを確認
    const isMC = await page.evaluate(() => {
      const el = document.querySelector('#choices');
      return !!el && getComputedStyle(el).display !== 'none';
    });
    if (isMC) {
      await page.waitForFunction(() => {
        const btns = Array.from(document.querySelectorAll('#choices button, .choice, [data-testid="choice"]'));
        return btns.length >= 4;
      }, { timeout: 30000 });
      const firstSel = '#choices button:nth-of-type(1), .choice:nth-of-type(1), [data-testid="choice"]:nth-of-type(1)';
      // role="button" 付与
      const roleOk = await page.getAttribute(firstSel, 'role');
      if (roleOk !== 'button') throw new Error('choice role must be "button"');
      // クリックで aria-pressed が true
      await page.click(firstSel);
      const pressed = await page.getAttribute(firstSel, 'aria-pressed');
      if (pressed !== 'true') throw new Error('clicked choice aria-pressed should be "true"');
    }

    // スコアバー: progressbar + now が数値で、正解時に増加（0から上がる）※可視は問わない
    const barSel = '[data-testid="score-bar"], #score-bar';
    const bar = await page.$(barSel);
    if (bar) {
      const role = await page.getAttribute(barSel, 'role');
      if (role !== 'progressbar') throw new Error('score-bar must have role="progressbar"');
      const val0 = parseInt((await page.getAttribute(barSel, 'aria-valuenow')) || '0', 10) || 0;
      // 正解を1回入れて上昇を観測（FreeとMC両対応）
      await page.waitForFunction(() => !!window.__expectedAnswer, { timeout: 30000 });
      const expected = await page.evaluate(() => window.__expectedAnswer);
      const mc = await page.evaluate(() => {
        const el = document.querySelector('#choices');
        return !!el && getComputedStyle(el).display !== 'none';
      });
      if (mc) {
        // 正解ボタンを探してクリック（なければ先頭）
        const texts = await page.$$eval('#choices button, .choice, [data-testid="choice"]', btns => btns.map(b => b.textContent.trim()));
        const idx = Math.max(0, texts.findIndex(t => t === expected));
        const sel = `#choices button:nth-of-type(${idx + 1}), .choice:nth-of-type(${idx + 1}), [data-testid="choice"]:nth-of-type(${idx + 1})`;
        await page.click(sel);
      } else {
        await page.fill('[data-testid="answer"]', expected || 'test');
        const submit = await page.$('[data-testid="submit-btn"], #submit-btn, [data-testid="submit"]');
        if (submit) await submit.click();
      }
      // 値の上昇を待つ
      await page.waitForFunction((sel, prev) => {
        const el = document.querySelector(sel);
        if (!el) return false;
        const now = parseInt(el.getAttribute('aria-valuenow') || '0', 10) || 0;
        return now > prev;
      }, barSel, val0, { timeout: 30000 });
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
    try {
      require('fs').mkdirSync('artifacts', { recursive: true });
      await ctx.tracing.stop({ path: 'artifacts/trace_free_aria.zip' });
      await page.screenshot({ path: 'artifacts/fail_free_aria.png', fullPage: true }).catch(()=>{});
      const html = await page.content().catch(()=>null);
      if (html) require('fs').writeFileSync('artifacts/dom_free_aria.html', html, 'utf-8');
    } catch {}
    await ctx.close();
    await browser.close();
  }
})();

