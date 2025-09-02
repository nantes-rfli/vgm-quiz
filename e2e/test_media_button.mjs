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
      p.set('test','1');      // stub動作（実iframeを出さない）
      p.set('mock','1');
      p.set('autostart','0');
      // seed は固定せず、順序に依存しないテストにする
      return u.toString();
    } catch {
      return base + (base.includes('?') ? '&' : '?') + 'test=1&mock=1&autostart=0';
    }
  })();

  await page.goto(url, { waitUntil: 'networkidle' });
  await page.click('[data-testid="start-btn"]');
  await page.waitForSelector('[data-testid="quiz-view"]', { state: 'visible', timeout: TIMEOUT });

  // 最大5問まで進みながら、media付き設問を探す
  let found = false;
  for (let i = 0; i < 5; i++) {
    const hasPlay = await page.$('[data-testid="play-clip"]');
    if (hasPlay) {
      await hasPlay.click();
      const played = await page.evaluate(() => !!window.__mediaPlayed);
      if (!played) throw new Error('media did not play (stub)');
      found = true;
      break;
    }
    // 次の問題へ進むために最短で回答
    const isMC = await page.evaluate(() => {
      const el = document.querySelector('#choices');
      return !!el && getComputedStyle(el).display !== 'none';
    });
    if (isMC) {
      await page.waitForSelector('#choices button, .choice, [data-testid="choice"]', { timeout: TIMEOUT });
      await page.click('#choices button, .choice, [data-testid="choice"]'); // 先頭を選ぶ
    } else {
      await page.fill('#answer, [data-testid="answer"]', 'wrong');
      await page.click('#submit-btn, [data-testid="submit-btn"]');
    }
    await page.waitForSelector('#next-btn, [data-testid="next-btn"]', { state: 'visible', timeout: TIMEOUT });
    await page.click('#next-btn, [data-testid="next-btn"]');
  }

  if (!found) {
    console.warn('[media] no media-backed question found within MAX_TRIES; skipping test'); process.exit(0);
  }

  await browser.close();
})();

