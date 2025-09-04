// e2e/test_ui_motion_reduce.mjs
import { chromium } from 'playwright';

(async () => {
  const TIMEOUT = 30000;
  const browser = await chromium.launch();
  const context = await browser.newContext({});
  const page = await context.newPage();

  // Emulate reduced motion
  await page.emulateMedia({ reducedMotion: 'reduce' });

  const base = process.env.E2E_BASE_URL || process.env.APP_URL || 'https://nantes-rfli.github.io/vgm-quiz/app/';
  const u = new URL(base);
  u.searchParams.set('test', '1');
  u.searchParams.set('mock', '1');
  u.searchParams.set('autostart', '0');
  const url = u.toString();
  console.log('[motion-reduce] URL =', url);

  await page.goto(url, { waitUntil: 'networkidle', timeout: TIMEOUT });
  const startBtn = await page.waitForSelector('#start-btn', { state: 'visible', timeout: TIMEOUT });

  const res = await page.evaluate(() => {
    const el = document.querySelector('#start-btn');
    const cs = getComputedStyle(el);
    return {
      transitionProperty: cs.transitionProperty,
      transitionDuration: cs.transitionDuration,
      animationName: cs.animationName,
      animationDuration: cs.animationDuration,
    };
  });

  console.log('[motion-reduce] computed:', res);
  // Expect no transitions/animations (durations 0s or none)
  const durParts = res.transitionDuration.split(',').map(s => s.trim());
  const allZero = durParts.every(s => s === '0s' || s === '0ms' || s === '0');
  if (!allZero) {
    throw new Error(`[motion-reduce] transitionDuration not disabled: ${res.transitionDuration}`);
  }
  if (res.animationName !== 'none' && res.animationDuration !== '0s') {
    throw new Error(`[motion-reduce] animation still active: ${res.animationName} ${res.animationDuration}`);
  }

  await browser.close();
  console.log('Motion reduce smoke OK');
})();
