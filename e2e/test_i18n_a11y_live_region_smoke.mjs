import { chromium } from 'playwright';

(async () => {
  const TIMEOUT = 30000;
  const browser = await chromium.launch();
  const page = await browser.newPage();
  // Reduce motion in CI to avoid transient visibility/actionability issues
  try { await page.emulateMedia({ reducedMotion: 'reduce' }); } catch {}

  function urlWith(base, lang) {
    const u = new URL(base);
    const p = u.searchParams;
    p.set('test', '1');
    p.set('mock', '1');
    p.set('daily', '2000-01-01'); // 1問で結果へ
    p.set('autostart', '0');
    p.set('lang', lang);
    return u.toString();
  }

  function defaultBase() {
    const repo = process.env.GITHUB_REPOSITORY;
    if (repo) {
      const [owner, name] = repo.split('/');
      return `https://${owner}.github.io/${name}/app/`;
    }
    return 'http://127.0.0.1:8080/app/';
  }

  const base = process.env.E2E_BASE_URL || process.env.APP_URL || defaultBase();

  // ---- JA ----
  const jaUrl = urlWith(base, 'ja');
  await page.goto(jaUrl + (jaUrl.includes('?') ? '&' : '?') + 'mode=mc&choices_mode=mc');
  // Bridge page console to CI logs for deeper diagnostics
  page.on('console', msg => {
    try {
      console.log(`[APP:${msg.type()}] ${msg.text()}`);
    } catch {}
  });
  console.log(`[E2E] url(ja)=${page.url()}`);
  // Ensure app shell is present before proceeding
  try {
    await page.waitForSelector('#feedback, #start-view, #app, #app-root', { timeout: 20000 });
  } catch {}
  await page.waitForFunction(() => document.documentElement.lang === 'ja', null, { timeout: TIMEOUT });
  const liveStartJa = await page.textContent('#feedback');
  if (!liveStartJa || !/準備OK/.test(liveStartJa)) {
    throw new Error(`JA live region not ready: "${liveStartJa}"`);
  }
  // Start the quiz (ensure the button is visible before clicking)
  await page.waitForSelector('[data-testid="start-btn"]', { state: 'visible', timeout: TIMEOUT });
  // Start が disabled のままなら、最大30sまで有効化を待ってからクリック
  await page.waitForSelector('#start-btn:not([disabled])', { timeout: 30000 });
  await page.click('[data-testid="start-btn"]');

  // Choices can exist immediately but be mid-transition / off-visibility.
  // Prefer a programmatic click first to bypass actionability, then fall back to Locator.
  await page.waitForSelector('#choices button', { state: 'attached', timeout: TIMEOUT });
  // small delay to let any intro animation settle
  await page.waitForTimeout(500);
  let clicked = false;
  try {
    await page.$eval('#choices button', (el) => el && el.click());
    clicked = true;
  } catch {}
  if (!clicked) {
    const choiceLoc = page.locator('#choices button').first();
    try {
      await choiceLoc.waitFor({ state: 'visible', timeout: 3000 });
      await choiceLoc.click();
      clicked = true;
    } catch {
      try {
        await choiceLoc.click({ force: true });
        clicked = true;
      } catch {}
    }
  }
  if (!clicked) {
    throw new Error('Failed to click a choice via all strategies');
  }
  // --- Robust path to reach result dialog (v7) ---
  // Purpose: verify i18n+a11y live region and the ability to reach the final dialog,
  // without assuming the number of questions (locale can differ under ?daily).
  const resultDlg = page.locator('#result-view[role="dialog"]');
  const firstChoice = page.locator('#choices button').first();
  const nextBtn = page.locator('#next-btn');
  const questionTitle = page.locator('#question-title');
  const startBtn = page.locator('#start-btn');
  const inputField = page.locator('#answer-input');
  const submitBtn = page.locator('#submit-btn');

  // Helper: log to aid CI diagnostics
  const logStep = async (label) => {
    const lang = await page.locator('html').getAttribute('lang');
    const qText = await questionTitle.isVisible().then(v => v ? questionTitle.textContent() : Promise.resolve(''));
    const nextVisible = await nextBtn.isVisible().catch(() => false);
    console.log(`[E2E] step=${label} lang=${lang} nextVisible=${nextVisible} title=${(qText||'').trim()}`);
  };

  // Helper: ensure quiz has started (start-view → play-view)
  const ensureStarted = async () => {
    if (await firstChoice.isVisible().catch(() => false)) return;
    if (await resultDlg.isVisible().catch(() => false)) return;
    // Wait for presence (not visibility) of start button
    const startPresent = await page.locator('#start-btn').count().then(c => c > 0).catch(() => false);
    if (!startPresent) return;
    // Wait up to 12s for enabled
    try { await page.waitForSelector('#start-btn:not([disabled])', { timeout: 12000 }); } catch {}
    // Prefer normal click when visible; otherwise programmatic click
    const visible = await startBtn.isVisible().catch(() => false);
    if (visible) {
      await startBtn.scrollIntoViewIfNeeded().catch(() => {});
      await startBtn.click({ trial: true }).catch(() => {});
      await startBtn.click().catch(() => {});
      await page.waitForTimeout(250);
      await logStep('clicked-start-visible');
    } else {
      await page.evaluate(() => {
        const el = document.querySelector('#start-btn');
        if (!el) return;
        try { el.click(); } catch {}
        try { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); } catch {}
      }).catch(() => {});
      await page.waitForTimeout(300);
      await logStep('clicked-start-programmatic');
    }
    // After clicking, wait briefly for either choices or input to appear
    await Promise.race([
      firstChoice.waitFor({ state: 'visible', timeout: 1500 }).catch(() => {}),
      inputField.waitFor({ state: 'visible', timeout: 1500 }).catch(() => {})
    ]);
  };

  // Pre-phase: wait longer for Start to become enabled (up to 20s total), then click once.
  try {
    await page.waitForSelector('#start-btn:not([disabled])', { timeout: 20000 });
    await startBtn.click({ trial: true }).catch(() => {});
    await startBtn.click().catch(() => {});
    await page.waitForTimeout(300);
    await logStep('pre-clicked-start');
    // After clicking start, wait briefly for either choices or input field to appear
    await Promise.race([
      firstChoice.waitFor({ state: 'visible', timeout: 1500 }).catch(() => {}),
      inputField.waitFor({ state: 'visible', timeout: 1500 }).catch(() => {})
    ]);
  } catch {
    // If Start never became enabled in 20s, the loop below will try ensureStarted() again.
    await logStep('pre-start-timeout');
  }

  let reached = false;
  let lastTitle = '';
  // Try up to 20 cycles; each cycle either answers or advances, then waits briefly for UI to settle.
  for (let step = 0; step < 20; step++) {
    // Quick-path: already on result?
    try {
      await resultDlg.waitFor({ state: 'visible', timeout: 800 });
      reached = true;
      break;
    } catch {}

    await ensureStarted();

    // Answer if a choice is visible (MC)
    if (await firstChoice.isVisible().catch(() => false)) {
      await firstChoice.click({ trial: true }).catch(() => {});
      await firstChoice.click().catch(() => {});
      await logStep(`answered-${step}`);
    }

    // Fallback: free-input mode
    else if (await inputField.isVisible().catch(() => false)) {
      await inputField.fill('x').catch(() => {});
      if (await submitBtn.isVisible().catch(() => false)) {
        await submitBtn.click({ trial: true }).catch(() => {});
        await submitBtn.click().catch(() => {});
      } else {
        await inputField.press('Enter').catch(() => {});
      }
      await logStep(`submitted-input-${step}`);
    }

    // Press Next if available
    if (await nextBtn.isVisible().catch(() => false)) {
      await nextBtn.click({ trial: true }).catch(() => {});
      await nextBtn.click().catch(() => {});
      await logStep(`next-${step}`);
    } else {
      // Programmatic Next as final fallback
      await page.evaluate(() => {
        const el = document.querySelector('#next-btn');
        if (!el) return;
        try { el.click(); } catch {}
        try { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); } catch {}
      }).catch(() => {});
    }

    // Wait for either a new question title or the result dialog
    const prev = lastTitle;
    lastTitle = await questionTitle.isVisible().then(v => v ? questionTitle.textContent() : Promise.resolve('')) || '';
    await page.waitForTimeout(250);

    try {
      await resultDlg.waitFor({ state: 'visible', timeout: 800 });
      reached = true;
      break;
    } catch {
      // If neither result became visible nor title changed, give UI a bit more time.
      const nowTitle = await questionTitle.isVisible().then(v => v ? questionTitle.textContent() : Promise.resolve('')) || '';
      if ((nowTitle || '') === (prev || '')) {
        await page.waitForTimeout(350);
      }
    }
  }
  if (!reached) {
    // Extra diagnostics before failing
    const nextVisible = await nextBtn.isVisible().catch(() => false);
    const choiceVisible = await firstChoice.isVisible().catch(() => false);
    const startVisible = await startBtn.isVisible().catch(() => false);
    const startDisabled = startVisible ? (await startBtn.getAttribute('disabled').catch(() => null)) !== null : null;
    console.log(`[E2E] failure diagnostics: nextVisible=${nextVisible} choiceVisible=${choiceVisible} startVisible=${startVisible} startDisabled=${startDisabled}`);
    throw new Error('result-view not visible after advancing through questions (v7)');
  }
  const liveOpenedJa = await page.textContent('#feedback');
  if (!/結果/.test(liveOpenedJa || '')) {
    throw new Error(`JA live region did not announce results: "${liveOpenedJa}"`);
  }
  await page.keyboard.press('Escape');
  await page.waitForSelector('[data-testid="start-btn"]', { state: 'visible', timeout: TIMEOUT });
  const liveReadyAgainJa = await page.textContent('#feedback');
  if (!/準備OK/.test(liveReadyAgainJa || '')) {
    throw new Error(`JA live region not reset: "${liveReadyAgainJa}"`);
  }

  // ---- EN ----
  const enUrl = urlWith(base, 'en');
  await page.goto(enUrl + (enUrl.includes('?') ? '&' : '?') + 'mode=mc&choices_mode=mc');
  await page.waitForFunction(() => document.documentElement.lang === 'en', null, { timeout: TIMEOUT });
  const liveStartEn = await page.textContent('#feedback');
  if (!/Ready/i.test(liveStartEn || '')) {
    throw new Error(`EN live region not ready: "${liveStartEn}"`);
  }

  // Click Start
  await page.waitForSelector('#start-btn:not([disabled])', { timeout: 15000 });
  await page.click('#start-btn');

  // Progress forward robustly until result is visible (do not assume single question)
  const maxSteps = 12;
  let reached = false;
  for (let i = 0; i < maxSteps; i++) {
    // If result is already visible, stop
    if (await page.locator('#result-view').isVisible().catch(() => false)) { reached = true; break; }
    // Otherwise, answer one MC question and click Next
    await page.waitForSelector('#question-view', { timeout: 10000 });
    const choice = page.locator('#choices button').first();
    await choice.waitFor({ state: 'visible', timeout: 10000 });
    await choice.click();
    const next = page.locator('#next-btn');
    await next.waitFor({ state: 'visible', timeout: 10000 });
    await next.click();
    // Small settle
    await page.waitForTimeout(200);
  }
  if (!reached) {
    throw new Error('result-view not visible within maxSteps');
  }

  await browser.close();
})();

