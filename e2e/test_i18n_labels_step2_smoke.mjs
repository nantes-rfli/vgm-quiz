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

  // Helper: read text if element exists
  async function readIfExists(selector) {
    const el = await page.$(selector);
    if (!el) return null;
    return (await el.textContent())?.trim() ?? null;
  }

  // JA labels
  await page.goto(urlWith(base, 'ja'));
  await page.waitForFunction(() => document.documentElement.lang === 'ja', null, { timeout: TIMEOUT });

  const checksJa = [
    { sel: '[data-testid="start-btn"], #start-btn, button#start, button[data-action="start"]', re: /スタート/ },
    { sel: '#history-heading', re: /履歴/ },
    { sel: '#result-heading, #results-heading', re: /結果/ },
    { sel: '#share-result-btn, [data-testid="share-result-btn"]', re: /シェア/ },
    { sel: '#copy-result-btn, [data-testid="copy-result-btn"]', re: /コピー/ },
    { sel: '#restart-btn, [data-testid="restart-btn"], button[data-action="restart"]', re: /(リスタート|もう一度)/ },
  ];

  for (const c of checksJa) {
    const text = await readIfExists(c.sel);
    if (text && !c.re.test(text)) {
      throw new Error(`Unexpected JA label for ${c.sel}: "${text}"`);
    }
  }

  // EN labels
  await page.goto(urlWith(base, 'en'));
  await page.waitForFunction(() => document.documentElement.lang === 'en', null, { timeout: TIMEOUT });

  const checksEn = [
    { sel: '[data-testid="start-btn"], #start-btn, button#start, button[data-action="start"]', re: /start/i },
    { sel: '#history-heading', re: /history/i },
    { sel: '#result-heading, #results-heading', re: /result/i },
    { sel: '#share-result-btn, [data-testid="share-result-btn"]', re: /share/i },
    { sel: '#copy-result-btn, [data-testid="copy-result-btn"]', re: /copy/i },
    { sel: '#restart-btn, [data-testid="restart-btn"], button[data-action="restart"]', re: /restart/i },
  ];

  for (const c of checksEn) {
    const text = await readIfExists(c.sel);
    if (text && !c.re.test(text)) {
      throw new Error(`Unexpected EN label for ${c.sel}: "${text}"`);
    }
  }

  await browser.close();
})();

