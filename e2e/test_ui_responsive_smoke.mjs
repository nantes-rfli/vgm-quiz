// e2e/test_ui_responsive_smoke.mjs
import { chromium } from 'playwright';

(async () => {
  const TIMEOUT = 30000;
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const base = process.env.E2E_BASE_URL || process.env.APP_URL || 'https://nantes-rfli.github.io/vgm-quiz/app/';
  const u = new URL(base);
  u.searchParams.set('test', '1');
  u.searchParams.set('mock', '1');
  u.searchParams.set('autostart', '0');
  u.searchParams.set('mode', 'multiple-choice'); // force choices mode

  const url = u.toString();
  console.log('[ui-resp] URL =', url);
  await page.goto(url, { waitUntil: 'networkidle', timeout: TIMEOUT });

  // 44px touch target (Start)
  const startBtn = await page.waitForSelector('#start-btn', { state: 'visible', timeout: TIMEOUT });
  const box = await startBtn.boundingBox();
  if (!box || box.height < 44) {
    throw new Error(`[ui-resp] start-btn height=${box?.height} < 44px`);
  } else {
    console.log('[OK] start-btn min 44px (', box.height, 'px )');
  }

  // Start quiz → show choices
  await startBtn.click();
  await page.waitForSelector('#choices', { state: 'visible', timeout: TIMEOUT });

  async function countCols() {
    return await page.evaluate(() => {
      const el = document.querySelector('#choices');
      const style = getComputedStyle(el).gridTemplateColumns;
      // Prefer repeat(N, ...) form if present (e.g., "repeat(2, minmax(0px, 1fr))")
      const m = style.match(/repeat\((\d+)\s*,/);
      let count;
      if (m) {
        count = parseInt(m[1], 10);
      } else {
        // Fallback: number of explicit tracks in the serialized value
        count = style.trim().split(/\s+/).filter(Boolean).length;
      }
      return { count, style };
    });
  }

  const cases = [
    { w: 480, expect: 2 },
    { w: 700, expect: 3 },
    { w: 1000, expect: 4 },
  ];

  for (const c of cases) {
    await page.setViewportSize({ width: c.w, height: 800 });
    // Give media queries time to settle
    await page.waitForTimeout(120);
    // Ensure at least one choice has rendered (avoid early single-item row)
    await page.waitForFunction(() => {
      const el = document.querySelector('#choices');
      return el && el.querySelectorAll('button, .choice').length >= 1;
    }, { timeout: TIMEOUT });
    const res = await countCols();
    if (res.count !== c.expect) {
      throw new Error(`[ui-resp] width=${c.w} cols=${res.count} (style="${res.style}") expected ${c.expect}`);
    } else {
      console.log(`[OK] width=${c.w} → ${c.expect} cols (style="${res.style}")`);
    }
  }

  await browser.close();
  console.log('UI responsive smoke OK');
})();

