import { test, expect } from '@playwright/test';

test('footer shows dataset / short commit / optional updated', async ({ page }) => {
  const url = process.env.E2E_BASE_URL
    || 'http://localhost:4173/app/?test=1&mock=1&seed=e2e&autostart=0';
  await page.goto(url, { waitUntil: 'domcontentloaded' });

  const el = page.locator('#footer-version, #version, footer .version').first();
  await expect(el).toBeVisible();

  const text = (await el.textContent() || '').trim();

  // 許容パターン：
  // - 本番:  Dataset: vN • commit: abcdefg • updated: YYYY-MM-DD HH:mm（updatedは任意）
  // - テスト: Dataset: mock • commit: local
  const re = /^Dataset:\s+(v\d+|[A-Za-z0-9._-]+)\s+•\s+commit:\s+(local|[0-9a-f]{7})(?:\s+•\s+updated:\s+\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})?$/;

  expect.soft(text).toMatch(re);

  // 追加の厳格チェック: local でない場合は 7桁
  const m = text.match(/commit:\s+([^\s•]+)/);
  if (m && m[1] !== 'local') {
    expect(m[1].length).toBe(7);
    expect(m[1]).toMatch(/^[0-9a-f]{7}$/);
  }
});

