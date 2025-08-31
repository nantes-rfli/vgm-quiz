// E2E: デイリーページの共有URLと共有HTMLのOGP/リダイレクトを検証
const { chromium } = require('playwright');

function jstISO() {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' });
  const p = Object.fromEntries(fmt.formatToParts(new Date()).map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}

(async () => {
  const APP_URL = process.env.APP_URL;
  if (!APP_URL) throw new Error('APP_URL env is required');
  const date = jstISO();
  const appUrl = `${APP_URL}?daily=${date}&test=1&autostart=0`;
  const publicBase = APP_URL.replace(/\/app\/?.*$/, '');
  const shareUrl = `${publicBase}/daily/${date}.html`;

  const browser = await chromium.launch();
  const context = await browser.newContext();
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const page = await context.newPage();

  // 1) デイリーモードでは share_patch.js により copyToClipboard が
  //    /daily/YYYY-MM-DD.html を書き込む。UIを介さず直接呼び出して検証する。
  await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    if (typeof window.copyToClipboard === 'function') {
      await window.copyToClipboard('dummy');
    } else {
      throw new Error('copyToClipboard is not defined');
    }
  });
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  if (!clip.includes(`/daily/${date}.html`)) {
    throw new Error(`[share] clipboard mismatch. expected suffix /daily/${date}.html, got: ${clip}`);
  }

  // 2) 共有ページの静的HTMLにOGタグがあり、meta refresh先が /app/?daily=... であること
  const resp = await page.request.get(shareUrl);
  if (resp.status() === 200) {
    const html = await resp.text();
    const ogImgOk = html.includes(`/ogp/daily-${date}.png`);
    const refreshOk = html.includes(`/app/?daily=${date}`);
    if (!ogImgOk || !refreshOk) {
      throw new Error(`[share] share HTML missing tags: og:image ok? ${ogImgOk}, refresh ok? ${refreshOk}`);
    }
  } else if (resp.status() === 404) {
    // 当日の daily.yml がまだ走ってない手動実行ケースはスキップ
    console.warn(`[share] share page 404 (ok for manual runs before daily). url=${shareUrl}`);
  } else {
    throw new Error(`[share] unexpected HTTP ${resp.status()} for ${shareUrl}`);
  }

  await browser.close();
  console.log('[E2E share] OK');
})();
