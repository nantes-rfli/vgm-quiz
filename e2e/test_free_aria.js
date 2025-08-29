// Minimal Playwright E2E for: free mode + A11y structure (no game-state waits)
// Runs standalone with `node e2e/test_free_aria.js`
const { chromium } = require('playwright');

(async () => {
  // Base URL（CI から E2E_BASE_URL を受け取り、必要パラメータが無ければ補完）
  const base0 =
    process.env.E2E_BASE_URL ||
    'https://nantes-rfli.github.io/vgm-quiz/app/?test=1&mock=1&seed=e2e&autostart=0';
  const url = new URL(base0);
  const ensure = (k, v) => { if (!url.searchParams.has(k)) url.searchParams.set(k, v); };
  ensure('test', '1'); ensure('mock', '1'); ensure('seed', 'e2e'); ensure('autostart', '0');

  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  // --- tracing for artifacts ---
  try { await ctx.tracing.start({ screenshots: true, snapshots: true, sources: true }); } catch {}

  try {
    console.log('[E2E A11y] URL:', url.toString());
    await page.goto(url.toString(), { waitUntil: 'domcontentloaded' });

    // quiz-view が見えていれば Start は押さない（自動開始にも耐性）
    const quizVisible = await page.evaluate(() => {
      const el = document.querySelector('#quiz-view, [data-testid="quiz-view"]');
      return !!el && getComputedStyle(el).display !== 'none';
    });

    if (!quizVisible) {
      // Start ボタン検出（CSSとtext/roleを混在しない）
      const startCss = page.locator('#start-btn, [data-testid="start-btn"]');
      if (await startCss.count()) {
        await startCss.first().click();
      } else {
        // アクセシブルネーム（英/日）で検索
        const startByRole = page.getByRole('button', { name: /^(start|開始|はじめる|スタート)$/i });
        if (await startByRole.count()) {
          await startByRole.first().click();
        } else {
          // 最後の手段：テキスト一致
          const startByText = page.getByText(/^start$/i);
          if (await startByText.count()) {
            await startByText.first().click();
          }
        }
      }
      // どのみち quiz-view が見えるまで待つ
      await page.waitForSelector('#quiz-view, [data-testid="quiz-view"]', { timeout: 10000 });
    } else {
      console.log('[A11y] quiz already visible; skipping Start');
    }

    // 1) タイマー: aria-live / aria-atomic を検証（可視かどうかは問わない）
    const timerSel = '[data-testid="timer"], #timer';
    const timer = await page.$(timerSel);
    if (!timer) throw new Error('timer element not found');
    const timerVisible = await page.isVisible(timerSel).catch(() => false);
    const ariaLive = await page.getAttribute(timerSel, 'aria-live');
    const ariaAtomic = await page.getAttribute(timerSel, 'aria-atomic');
    console.log(`[A11y] timer present; visible=${timerVisible} aria-live=${ariaLive} aria-atomic=${ariaAtomic}`);
    if (!ariaLive) throw new Error('timer must have aria-live');
    if (String(ariaAtomic) !== 'true') throw new Error('timer must have aria-atomic="true"');

    // 2) フォーカス初期位置: 最初の操作対象（Free: answer、MC: 最初の選択肢）のいずれか
    const focusOk = await page.evaluate(() => {
      const ae = document.activeElement;
      if (!ae) return false;
      const ans = document.querySelector('[data-testid="answer"]');
      const choice = document.querySelector('#choices button, .choice, [data-testid="choice"]');
      return ae === ans || ae === choice;
    });
    console.log('[A11y] focus on first control:', focusOk);
    if (!focusOk) throw new Error('initial focus must be on first interactive control');

    // 3) スコアバー: role/aria-valuenow が妥当（動的な上昇待ちはしない）
    const barSel = '[data-testid="score-bar"], #score-bar';
    const bar = await page.$(barSel);
    if (bar) {
      const role = await page.getAttribute(barSel, 'role');
      if (role !== 'progressbar') throw new Error('score-bar must have role="progressbar"');
      const now = parseInt((await page.getAttribute(barSel, 'aria-valuenow')) || '0', 10);
      if (Number.isNaN(now)) throw new Error('score-bar aria-valuenow must be a number');
    }

    // 4) 誤答時の HUD 変化を軽く触る（強いアサーションはしない）
    const answer = await page.$('[data-testid="answer"]');
    if (answer) {
      const livesSel = '[data-testid="lives"], #lives';
      const livesBefore = await page.textContent(livesSel).catch(() => null);
      await page.fill('[data-testid="answer"]', 'dummy wrong answer');
      const submitSel = '[data-testid="submit-btn"], #submit-btn, [data-testid="submit"]';
      const submit = await page.$(submitSel);
      if (submit) await submit.click();
      await page.waitForTimeout(400);
      const livesAfter = await page.textContent(livesSel).catch(() => null);
      console.log(`[A11y] lives before/after: ${livesBefore} -> ${livesAfter}`);
      // lives が取れない実装でも落とさない（A11y 構造が主目的）
    }

    console.log('[OK] free-mode A11y structure checks passed');
  } finally {
    try {
      require('fs').mkdirSync('artifacts', { recursive: true });
      await ctx.tracing.stop({ path: 'artifacts/trace_free_aria.zip' });
      await page.screenshot({ path: 'artifacts/fail_free_aria.png', fullPage: true }).catch(() => {});
      const html = await page.content().catch(() => null);
      if (html) require('fs').writeFileSync('artifacts/dom_free_aria.html', html, 'utf-8');
    } catch {}
    await ctx.close();
    await browser.close();
  }
})();
