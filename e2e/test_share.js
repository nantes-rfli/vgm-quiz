// E2E: デイリーページの共有URLと共有HTMLのOGP/リダイレクトを検証
const { chromium } = require('playwright');

// cache-busting fetch (bypass CDN)
async function fetchNoCache(page, url) {
  const sep = url.includes('?') ? '&' : '?';
  const u = `${url}${sep}e2e=${Date.now()}`;
  return await page.request.get(u, {
    headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
  });
}

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
  const latestUrl = `${publicBase}/daily/latest.html`;
  const sharePatchUrl = `${publicBase}/app/share_patch.js`;

  const browser = await chromium.launch();
  const context = await browser.newContext();
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const page = await context.newPage();

  // 1) デイリーモード（明示日付）でコピーされるURLが /daily/YYYY-MM-DD.html
  await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
  // SWやキャッシュの影響で share_patch が未適用の場合、待って→ダメなら動的注入
  const ready = await page.waitForFunction(
    () => typeof window.copyToClipboard === 'function' || !!window.__sharePatchReady,
    { timeout: 3000 }
  ).catch(() => null);
  if (!ready) {
    await page.addScriptTag({ url: `${sharePatchUrl}?e2e=${Date.now()}` });
    await page.waitForFunction(
      () => typeof window.copyToClipboard === 'function' || !!window.__sharePatchReady,
      { timeout: 5000 }
    );
  }
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
  const resp = await fetchNoCache(page, shareUrl);
  if (resp.status() === 200) {
    const html = await resp.text();
    const ogImgOk = html.includes(`/ogp/daily-${date}.png`);
    const refreshOk = html.includes(`/app/?daily=${date}`);
    // 必須（旧版でも満たす）: og:image と meta refresh
    if (!ogImgOk || !refreshOk) {
      throw new Error(`[share] share HTML missing required tags. og:image:${ogImgOk} refresh:${refreshOk}`);
    }
    // 任意（新拡張）: 画像サイズ/Twitterメタは、未再生成の旧版では欠けていても許容（警告）
    const ogW = /property=["']og:image:width["'][^>]+content=["']1200["']/.test(html);
    const ogH = /property=["']og:image:height["'][^>]+content=["']630["']/.test(html);
    const twTitle = /name=["']twitter:title["'][^>]+content=["'][^"']*Daily\s+${date}[^"']*["']/.test(html);
    const twImage = /name=["']twitter:image["'][^>]+content=["'][^"']*\/ogp\/daily-${date}\.png/.test(html);
    if (!ogW || !ogH || !twTitle || !twImage) {
      console.warn(
        `[share] optional meta missing (likely old share page before regeneration). ` +
        `og:w:${ogW} og:h:${ogH} tw:title:${twTitle} tw:image:${twImage}`
      );
    }
  } else if (resp.status() === 404) {
    // 当日の daily.yml がまだ走ってない手動実行ケースはスキップ
    console.warn(`[share] share page 404 (ok for manual runs before daily). url=${shareUrl}`);
  } else {
    throw new Error(`[share] unexpected HTTP ${resp.status()} for ${shareUrl}`);
  }

  // 4) latest.html: allow meta refresh OR JS location.replace/location.href to ./YYYY-MM-DD.html
  const respLatest = await fetchNoCache(page, latestUrl);
  if (respLatest.status() === 200) {
    const html = await respLatest.text();
    // Compute prevDate in JST
    const nowJst = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
    const prev = new Date(nowJst.getTime()); prev.setDate(prev.getDate() - 1);
    const prevDate = `${prev.getFullYear()}-${String(prev.getMonth()+1).padStart(2,'0')}-${String(prev.getDate()).padStart(2,'0')}`;
    const metaTodayRe = new RegExp(`http-equiv=["']refresh["'][^>]+url=\\./${date}\\.html`, 'i');
    const metaPrevRe  = new RegExp(`http-equiv=["']refresh["'][^>]+url=\\./${prevDate}\\.html`, 'i');
    const jsTodayRe   = new RegExp(`location\\.(?:replace|href)\\(\\s*["']\\./${date}\\.html["']\\s*\\)`, 'i');
    const jsPrevRe    = new RegExp(`location\\.(?:replace|href)\\(\\s*["']\\./${prevDate}\\.html["']\\s*\\)`, 'i');
    const aTodayRe    = new RegExp(`<a[^>]+href=["']\\./${date}\\.html["']`, 'i');
    const aPrevRe     = new RegExp(`<a[^>]+href=["']\\./${prevDate}\\.html["']`, 'i');
    const isToday = metaTodayRe.test(html) || jsTodayRe.test(html) || aTodayRe.test(html);
    const isPrev  = (!isToday) && (metaPrevRe.test(html) || jsPrevRe.test(html) || aPrevRe.test(html));
    if (!isToday && !isPrev) {
      const snippet = html.slice(0, 400).replace(/\s+/g,' ').trim();
      throw new Error(`[share] latest.html does not redirect to today (${date}) nor prev (${prevDate}); head snippet: ${snippet}`);
    } else {
      console.log(`[share] latest.html redirect detected -> ${isToday ? date : prevDate}`);
    }
  } else {
    console.warn(`[share] latest.html HTTP ${respLatest.status()} (unexpected); url=${latestUrl}`);
  }

  // 3) ?daily=1 でも同様に当日(JST)のURLがコピーされる
  const appUrlToday = `${APP_URL}?daily=1&test=1&autostart=0`;
  await page.goto(appUrlToday, { waitUntil: 'domcontentloaded' });
  const ready2 = await page.waitForFunction(
    () => typeof window.copyToClipboard === 'function' || !!window.__sharePatchReady,
    { timeout: 3000 }
  ).catch(() => null);
  if (!ready2) {
    await page.addScriptTag({ url: `${sharePatchUrl}?e2e=${Date.now()}` });
    await page.waitForFunction(
      () => typeof window.copyToClipboard === 'function' || !!window.__sharePatchReady,
      { timeout: 5000 }
    );
  }
  await page.evaluate(async () => {
    if (typeof window.copyToClipboard === 'function') {
      await window.copyToClipboard('dummy');
    } else {
      throw new Error('copyToClipboard is not defined');
    }
  });
  const clip2 = await page.evaluate(() => navigator.clipboard.readText());
  if (!clip2.includes(`/daily/${date}.html`)) {
    throw new Error(`[share] (?daily=1) clipboard mismatch. expected suffix /daily/${date}.html, got: ${clip2}`);
  }

  await browser.close();
  console.log('[E2E share] OK');
})();
