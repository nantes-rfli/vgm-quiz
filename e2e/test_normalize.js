const { chromium } = require('playwright');

async function run() {
  const APP_URL = process.env.E2E_BASE_URL || process.env.APP_URL || 'https://nantes-rfli.github.io/vgm-quiz/app/';
  const url = `${APP_URL}?test=1&mock=1&autostart=0`;
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded' });

  // Wait for __testAPI to be ready
  await page.waitForFunction(() => window.__testAPI && window.__testAPI.ready);

  async function ok(a, b, msg) {
    const match = await page.evaluate(([x, y]) => window.__testAPI.normalizeMatch(x, y), [a, b]);
    if (!match) {
      throw new Error(`normalize mismatch: ${msg} :: "${a}" vs "${b}"`);
    }
    console.log('[OK]', msg);
  }

  await ok('Ｍｅｇａｌｏｍａｎｉａ', 'Megalomania', 'NFKC fold full-width');
  await ok('Pokemon', 'Pokémon', 'diacritics fold');
  await ok('Pokemon', 'Poke\u0301mon', 'diacritics fold (precomposed vs combining)');
  await ok('キングダムハーツ', 'キングダムハーツ', 'NFKC vs NFD combine');
  await ok('Final Fantasy IV', 'Final Fantasy 4', 'Roman↔Arabic (1–20)');
  await ok('The Legend of Zelda', 'Legend of Zelda', 'Articles ignored');
  await ok('Baba & You', 'Baba and You', '& → and');
  await ok('Chrono Trigger — Corridors of Time', 'Chrono Trigger Corridors of Time', 'punctuation/spaces/choonpu');

  // Alias: if aliases map contains known pairs, try one generic probe.
  // We can't depend on specific content, but we can validate that normalization runs without error and returns strings.
  const norm = await page.evaluate(() => window.__testAPI.normalize('Megalovania'));
  if (typeof norm !== 'string') throw new Error('normalize must return string');
  console.log('[OK] normalize returns string');

  await browser.close();
  console.log('[E2E normalize] PASS');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
