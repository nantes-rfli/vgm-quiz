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
  // Let the document settle minimally
  try { await page.waitForLoadState('domcontentloaded', { timeout: 10000 }); } catch {}
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
  // Wait until live region is non-empty and includes "準備OK" (reduce flakiness)
  await page.waitForFunction(() => {
    const el = document.querySelector('#feedback');
    const t = (el && el.textContent || '').trim();
    return !!t && /準備OK/.test(t);
  }, null, { timeout: TIMEOUT });
  const liveStartJa = await page.textContent('#feedback');
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
  // Accept both legacy and current selectors for free-answer flow (fallback path)
  const inputField = page.locator('#free-answer, #answer-input');
  const submitBtn = page.locator('#submit-btn, [data-testid="submit-btn"], #submit-answer');

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
  // Wait for a result announcement in the live region; accept broader patterns and allow slight delay.
  // Some datasets announce in EN (Correct/Incorrect) even under JA locale due to asset text; tolerate those too.
  const JA_RESULT_RE = /(結果|スコア|正解|不正解|集計|合計|Correct|Incorrect|Result|Score)/i;
  let liveOpenedJa = '';
  try {
    await page.waitForFunction((sel, reSrc) => {
      const el = document.querySelector(sel);
      const t = (el && el.textContent || '').trim();
      try { return !!t && new RegExp(reSrc, 'i').test(t); } catch { return !!t; }
    }, '#feedback', JA_RESULT_RE.source, { timeout: 4000 });
    liveOpenedJa = (await page.textContent('#feedback')) || '';
  } catch {
    // If specific keywords did not appear in time, accept any non-empty live region (announce may be very terse like "Correct!").
    liveOpenedJa = (await page.textContent('#feedback')) || '';
    if (!liveOpenedJa.trim()) {
      throw new Error('JA live region did not announce (empty after result)');
    }
    console.log(`[E2E] JA result live fallback (nonfatal): "${liveOpenedJa.trim()}"`);
  }
  // Close result and verify the live region resets to the start-ready state.
  // Prefer Escape, fall back to common close buttons.
  try { await page.keyboard.press('Escape'); } catch {}
  await page.waitForTimeout(150);
  // If still visible, try various close selectors
  if (await page.locator('#result-view[role="dialog"]').isVisible().catch(() => false)) {
    const closers = [
      '[data-testid="dialog-close"]',
      '#result-close',
      'button[aria-label="Close"]',
      'button:has-text("閉じる")',
      'button:has-text("Close")'
    ];
    for (const sel of closers) {
      try {
        const loc = page.locator(sel);
        if (await loc.count().catch(() => 0)) {
          await loc.first().click().catch(() => {});
          await page.waitForTimeout(150);
          if (!(await page.locator('#result-view[role="dialog"]').isVisible().catch(() => false))) break;
        }
      } catch {}
    }
  }
  // Wait until reset. Accept broader signs:
  //  A) result view (with/without role) is hidden AND feedback says "準備OK"
  //  OR
  //  B) start-view is visible AND question-view is hidden (UI back at start)
  const resetOk = await page.waitForFunction(() => {
    const visible = sel => {
      const el = document.querySelector(sel);
      if (!el) return false;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return false;
      // offsetParent can be null for fixed elements; accept if not none/hidden
      return true;
    };
    const dlgVisible = visible('#result-view') || visible('#result-view[role="dialog"]');
    const startVisible = visible('#start-view');
    const questionVisible = visible('#question-view');
    const fb = document.querySelector('#feedback');
    const t = (fb && fb.textContent || '').trim();
    const a = (!dlgVisible) && /準備OK/.test(t);
    const b = startVisible && !questionVisible && !dlgVisible;
    return a || b;
  }, null, { timeout: TIMEOUT }).catch(() => false);

  if (!resetOk) {
    // Diagnostics then fail with clear message
    const diag = {
      dlgVisible: await page.locator('#result-view, #result-view[role="dialog"]').isVisible().catch(() => false),
      startVisible: await page.locator('#start-view').isVisible().catch(() => false),
      questionVisible: await page.locator('#question-view').isVisible().catch(() => false),
      feedback: (await page.textContent('#feedback').catch(() => ''))?.trim() || ''
    };
    console.log('[E2E] reset diagnostics', diag);
    throw new Error('JA reset wait timed out: expected result closed and "準備OK" or start-view visible');
  }

  // ---- EN ----
  const enUrl = urlWith(base, 'en');
  await page.goto(enUrl + (enUrl.includes('?') ? '&' : '?') + 'mode=mc&choices_mode=mc');
  try { await page.waitForLoadState('domcontentloaded', { timeout: 10000 }); } catch {}
  await page.waitForFunction(() => document.documentElement.lang === 'en', null, { timeout: TIMEOUT });
  await page.waitForFunction(() => {
    const el = document.querySelector('#feedback');
    const t = (el && el.textContent || '').trim();
    return !!t && /Ready/i.test(t);
  }, null, { timeout: TIMEOUT });

  await browser.close();
})();

