import { test, expect } from '@playwright/test';

test('footer shows dataset / short commit / optional updated', async ({ page }) => {
  const url =
    process.env.E2E_BASE_URL ||
    'http://127.0.0.1:8080/app/?test=1&mock=1&seed=e2e&autostart=0';
  await page.goto(url, { waitUntil: 'domcontentloaded' });

  const el = page.locator('#footer-version, #version, footer .version').first();
  await expect(el).toBeVisible();

  const text = (await el.textContent() || '').trim();
  console.log('[footer-version]', text);

  // 許容: Dataset は vN または非空英数記号、commit は local or 7桁HEX、updated は任意
  const re =
    /^Dataset:\s+(?<ds>v\d+|[A-Za-z0-9._-]+)\s+•\s+commit:\s+(?<commit>local|[0-9a-f]{7})(?:\s+•\s+updated:\s+(?<dt>\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}))?$/;
  const m = text.match(re);
  expect(m, 'footer text format').not.toBeNull();

  const { commit } = m!.groups!;
  if (commit !== 'local') {
    expect(commit).toMatch(/^[0-9a-f]{7}$/);
  }
});
