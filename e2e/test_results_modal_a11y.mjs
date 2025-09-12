import { chromium } from 'playwright';

(async () => {
  const TIMEOUT = 30000;
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const base = process.env.E2E_BASE_URL || process.env.APP_URL || 'http://127.0.0.1:8080/app/';
  const url = (() => {
    try {
      const u = new URL(base);
      const p = u.searchParams;
      p.set('test', '1');
      p.set('mock', '1');
      p.set('daily', '2000-01-01'); // 1問で終了
      p.set('autostart', '0');
      return u.toString();
    } catch {
      return base + (base.includes('?') ? '&' : '?') + 'test=1&mock=1&daily=2000-01-01&autostart=0';
    }
  })();

  await page.goto(url, { waitUntil: 'networkidle' });
  // Start: do not rely on visibility. Wait for presence + enabled, then click (visible → normal / hidden → programmatic).
  await page.waitForSelector('#start-btn', { state: 'attached', timeout: TIMEOUT });
  await page.waitForSelector('#start-btn:not([disabled])', { timeout: TIMEOUT });
  const startLoc = page.locator('#start-btn');
  const startVisible = await startLoc.isVisible().catch(() => false);
  if (startVisible) {
    await startLoc.scrollIntoViewIfNeeded().catch(() => {});
    await startLoc.click({ trial: true }).catch(() => {});
    await startLoc.click().catch(() => {});
  } else {
    await page.evaluate(() => {
      const el = document.querySelector('#start-btn');
      if (!el) return;
      try { el.click(); } catch {}
      try { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); } catch {}
    }).catch(() => {});
  }
  await page.waitForTimeout(200);
  // After clicking Start, wait for either MC choices or free input to appear (do not assume a mode).
  await Promise.race([
    page.waitForSelector('#choices button', { state: 'visible', timeout: 2000 }).catch(() => {}),
    page.waitForSelector('#answer, [data-testid="answer"]', { state: 'visible', timeout: 2000 }).catch(() => {})
  ]);
  await page.waitForSelector('[data-testid="quiz-view"]', { state: 'visible', timeout: TIMEOUT });

  // 1問を適当に回答→Next→結果
  const hasFree = await page.$('#answer, [data-testid="answer"]');
  if (hasFree) {
    await page.fill('#answer, [data-testid="answer"]', 'wrong');
    await page.click('#submit-btn, [data-testid="submit-btn"]');
  } else {
    await page.click('#choices button, .choice, [data-testid="choice"]');
  }
  await page.click('#next-btn, [data-testid="next-btn"]');
  await page.waitForSelector('#result-view[role="dialog"]', { state: 'visible', timeout: TIMEOUT });

  // 初期フォーカスはダイアログ内
  const inDialog = await page.evaluate(() => {
    const dlg = document.getElementById('result-view');
    return dlg && dlg.contains(document.activeElement);
  });
  if (!inDialog) throw new Error('initial focus is not inside result dialog');

  // Tabがループするか（先頭→末尾→先頭）
  await page.keyboard.press('Shift+Tab'); // 末尾へ
  const afterShiftTab = await page.evaluate(() => {
    const dlg = document.getElementById('result-view');
    const focusables = (sel => Array.from(dlg.querySelectorAll(sel)))(
      'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
    );
    return dlg && focusables.length && document.activeElement === focusables[focusables.length - 1];
  });
  if (!afterShiftTab) throw new Error('Shift+Tab did not wrap to last');

  await page.keyboard.press('Tab'); // 先頭へ
  const afterTab = await page.evaluate(() => {
    const dlg = document.getElementById('result-view');
    const focusables = (sel => Array.from(dlg.querySelectorAll(sel)))(
      'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
    );
    return dlg && focusables.length && document.activeElement === focusables[0];
  });
  if (!afterTab) throw new Error('Tab did not wrap to first');

  // EscでStartに戻る（Startボタンが再び見える）
  await page.keyboard.press('Escape');
  await page.waitForSelector('[data-testid="start-btn"]', { state: 'visible', timeout: TIMEOUT });

  await browser.close();
})();
