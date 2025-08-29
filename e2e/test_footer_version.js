// Verify footer version format (dataset + commit + optional updated)
// Dataset version must be either 'mock' (for test runs) or match M.YY
// where M is 1-12 (no leading zero) and YY is two-digit year.
const { chromium } = require('playwright');

(async () => {
  const base0 =
    process.env.E2E_BASE_URL ||
    'http://localhost:4173/app/?test=1&mock=1&seed=e2e&autostart=0';

  // ensure required query params (belt & suspenders)
  const url = new URL(base0);
  const ensure = (k, v) => { if (!url.searchParams.has(k)) url.searchParams.set(k, v); };
  ensure('test', '1');
  ensure('mock', '1');
  ensure('seed', 'e2e');
  ensure('autostart', '0');

  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    await page.goto(url.toString(), { waitUntil: 'domcontentloaded' });

    const sel = '#footer-version, #version, footer .version';
    await page.waitForSelector(sel, { timeout: 10000 });
    const text = (await page.textContent(sel) || '').trim();

    console.log('[footer-version]', text);

    // dataset: mock or M.YY
    const dsMatch = text.match(/^Dataset:\s+([^\s•]+)/);
    if (!dsMatch) throw new Error('dataset version missing');
    const ds = dsMatch[1];
    const mmYY = /^\d{1,2}\.\d{2}$/; // moment('M.YY') format
    if (ds !== 'mock' && !mmYY.test(ds)) {
      throw new Error(`dataset version '${ds}' not in M.YY format`);
    }

    // commit: local or 7 hex characters
    const commitMatch = text.match(/commit:\s+([^\s•]+)/);
    if (!commitMatch) throw new Error('commit hash missing');
    const commit = commitMatch[1];
    if (commit !== 'local' && !/^[0-9a-f]{7}$/.test(commit)) {
      throw new Error(`commit '${commit}' must be 7 hex or 'local'`);
    }

    // optional updated timestamp
    const updatedMatch = text.match(/updated:\s+(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})/);
    if (updatedMatch && isNaN(new Date(updatedMatch[1]).getTime())) {
      throw new Error('updated timestamp invalid');
    }

    console.log('[OK] footer version format looks good');
  } finally {
    await browser.close();
  }
})();

