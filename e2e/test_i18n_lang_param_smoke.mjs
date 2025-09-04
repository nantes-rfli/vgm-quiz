import { chromium } from 'playwright';

(async () => {
  const TIMEOUT = 30000;
  const browser = await chromium.launch();
  const page = await browser.newPage();

  function withLang(base, lang) {
    const u = new URL(base);
    const p = u.searchParams;
    p.set('test', '1');
    p.set('mock', '1');
    p.set('autostart', '0');
    p.set('lang', lang);
    return u.toString();
  }

  function defaultBase() {
    // In CI, prefer GitHub Pages URL derived from repo; locally fall back to localhost.
    const repo = process.env.GITHUB_REPOSITORY; // e.g., "nantes-rfli/vgm-quiz"
    if (repo) {
      const [owner, name] = repo.split('/');
      return `https://${owner}.github.io/${name}/app/`;
    }
    return 'http://127.0.0.1:8080/app/';
  }

  const base = process.env.E2E_BASE_URL || process.env.APP_URL || defaultBase();

  // en
  await page.goto(withLang(base, 'en'));
  await page.waitForFunction(() => document.documentElement.lang === 'en', null, { timeout: TIMEOUT });
  const titleEn = await page.title();
  if (!/VGM\s?Quiz/i.test(titleEn)) throw new Error(`Unexpected EN title: ${titleEn}`);

  // ja
  await page.goto(withLang(base, 'ja'));
  await page.waitForFunction(() => document.documentElement.lang === 'ja', null, { timeout: TIMEOUT });
  const titleJa = await page.title();
  if (!/VGM.?クイズ/.test(titleJa)) throw new Error(`Unexpected JA title: ${titleJa}`);

  await browser.close();
})();
