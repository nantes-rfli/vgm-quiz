const { chromium } = require('playwright');
const fs = require('fs');
const TIMEOUT = 45000;
const ART_DIR = 'artifacts';

async function dumpArtifacts(page, prefix = 'failure') {
  try {
    fs.mkdirSync(ART_DIR, { recursive: true });
    await page
      .screenshot({ path: `${ART_DIR}/${prefix}.png`, fullPage: true })
      .catch(() => {});
    const html = await page.content().catch(() => '');
    fs.writeFileSync(`${ART_DIR}/${prefix}.html`, html);
  } catch (_) {}
}

(async () => {
  const browser = await chromium.launch();
  // context を切ってトレースを有効化
  const context = await browser.newContext();
  const page = await context.newPage();

  // artifacts ディレクトリ
  fs.mkdirSync(ART_DIR, { recursive: true });

  // Playwright Trace を常時収集（失敗時の操作履歴/ネットワーク/スクショ等）
  await context.tracing.start({ screenshots: true, snapshots: true, sources: false });

  // 失敗の手がかりになるログも保存
  const log = (name, text) => {
    try {
      fs.appendFileSync(`${ART_DIR}/${name}`, text + '\n');
    } catch (_) {}
  };
  page.on('console', (msg) => {
    const text = `[${msg.type()}] ${msg.text()}`;
    log('console.log', text);
    try { console.log('[console]', msg.type(), msg.text()); } catch (_) {}
  });
  page.on('pageerror', (err) => {
    const text = `[pageerror] ${err?.message || err}`;
    log('console.log', text);
    try { console.error('[pageerror]', err); } catch (_) {}
  });
  page.on('requestfailed', (req) => {
    const text = `[fail] ${req.method()} ${req.url()} - ${req.failure()?.errorText}`;
    log('network.log', text);
    try { console.warn('[requestfailed]', req.url(), req.failure()?.errorText); } catch (_) {}
  });
  page.on('response', async (res) => {
    if (!res.ok()) {
      const text = `[${res.status()}] ${res.request().method()} ${res.url()}`;
      log('network.log', text);
      try { console.warn('[response]', text); } catch (_) {}
    }
  });

  try {
    const base = process.env.E2E_BASE_URL || process.env.APP_URL || 'http://127.0.0.1:8080/app/';
    const url = base.includes('?') ? `${base}&mock=1&seed=e2e` : `${base}?mock=1&seed=e2e`;
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    // 参考ログ（トレースで確認可能）
    try { console.log('[E2E URL]', url); } catch (_) {}
    // TEST_MODE では SW 未登録なので、キャッシュ関連の更新待ちは軽くなる
    // 以降の待機ロジックは既存のままでOK
    await page.waitForResponse(
      (resp) => resp.url().endsWith('/dataset.json') && resp.ok(),
      { timeout: TIMEOUT }
    );
    let picked = false;
    try {
      const hasMode = await page.$('#mode');
      if (hasMode) {
        await page
          .waitForSelector('#mode', { state: 'visible', timeout: 5000 })
          .catch(() => {});
        const values = await page.$$eval('#mode option', (opts) =>
          opts.map((o) => o.value || o.textContent.trim())
        );
        if (values.length > 0) {
          const wanted = ['multiple-choice', 'free'];
          const pick = wanted.find((w) => values.includes(w)) || values[0];
          await page
            .selectOption('#mode', { value: pick })
            .catch(async () => {
              await page
                .selectOption('#mode', { label: pick })
                .catch(() => {});
            });
          picked = true;
        }
      }
    } catch (e) {
      await dumpArtifacts(page, 'mode-select');
      // continue even if mode selection fails
    }

    await page.waitForSelector('[data-testid="start-btn"]', {
      state: 'visible',
      timeout: 15000,
    });
    await page.click('[data-testid="start-btn"]');

    await page.waitForSelector('[data-testid="quiz-view"]', { state: 'visible' });

    await page.waitForFunction(
      () => {
        const first = document.querySelector('#choices button');
        return first && first.textContent.trim() === window.__expectedAnswer;
      },
      { timeout: TIMEOUT }
    );

    await page.click('#choices button');

    await page.waitForFunction(
      () => /Score: 1/.test(document.querySelector('[data-testid="score-bar"]').textContent),
      { timeout: TIMEOUT }
    );
  } catch (e) {
    await dumpArtifacts(page, 'fail_test_js');
    throw e;
  } finally {
    try {
      await context.tracing.stop({ path: `${ART_DIR}/trace.zip` });
    } catch (_) {}
    await browser.close();
  }
})();

