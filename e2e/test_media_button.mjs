import { chromium } from 'playwright';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const base = process.env.E2E_BASE_URL || process.env.APP_URL || 'http://127.0.0.1:8080/app/';
  const url = (() => {
    try {
      const u = new URL(base);
      const p = u.searchParams;
      if (!p.has('test')) p.set('test','1');  // ← stub動作
      if (!p.has('mock')) p.set('mock','1');
      if (!p.has('seed')) p.set('seed','alpha');
      if (!p.has('autostart')) p.set('autostart','0');
      return u.toString();
    } catch {
      return base + (base.includes('?')?'&':'?') + 'test=1&mock=1&seed=alpha&autostart=0';
    }
  })();
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.click('[data-testid="start-btn"]');
  await page.waitForSelector('[data-testid="quiz-view"]', { state: 'visible' });
  // 再生ボタンが出る（mockの1問目にmediaを付与済み）
  await page.waitForSelector('[data-testid="play-clip"]', { state: 'visible' });
  await page.click('[data-testid="play-clip"]');
  // stub フラグが立つ
  const played = await page.evaluate(() => !!window.__mediaPlayed);
  if (!played) throw new Error('media did not play (stub)');
  // そのまま解答～次へが可能（UIブロックなし）
  const hasFree = await page.$('#answer, [data-testid="answer"]');
  if (hasFree) {
    await page.fill('#answer, [data-testid="answer"]', 'wrong');
    await page.click('#submit-btn, [data-testid="submit-btn"]');
  } else {
    await page.click('#choices button:nth-of-type(1)');
  }
  await page.click('#next-btn, [data-testid="next-btn"]');
  await browser.close();
})();
