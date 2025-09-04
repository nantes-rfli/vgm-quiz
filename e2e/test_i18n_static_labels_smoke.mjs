import { chromium } from 'playwright';

(async () => {
  const TIMEOUT = 30000;
  const browser = await chromium.launch();
  const page = await browser.newPage();

  function urlWith(base, lang) {
    const u = new URL(base);
    const p = u.searchParams;
    p.set('test', '1');
    p.set('mock', '1');
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

  // EN labels
  await page.goto(urlWith(base, 'en'));
  await page.waitForFunction(() => document.documentElement.lang === 'en', null, { timeout: TIMEOUT });
  const startEn = await page.textContent('[data-testid="start-btn"], #start-btn, button#start, button[data-action="start"]');
  if (!startEn || !/start/i.test(startEn.trim())) throw new Error(`unexpected Start label (en): "${startEn}"`);

  // JA labels
  await page.goto(urlWith(base, 'ja'));
  await page.waitForFunction(() => document.documentElement.lang === 'ja', null, { timeout: TIMEOUT });
  const startJa = await page.textContent('[data-testid="start-btn"], #start-btn, button#start, button[data-action="start"]');
  if (!startJa || !/スタート/.test(startJa.trim())) throw new Error(`unexpected Start label (ja): "${startJa}"`);

  await browser.close();
})();
