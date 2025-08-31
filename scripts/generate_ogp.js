#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

function jstDateString(d = new Date()) {
  const tz = 'Asia/Tokyo';
  const y = d.toLocaleString('ja-JP', { timeZone: tz, year: 'numeric' });
  const m = d.toLocaleString('ja-JP', { timeZone: tz, month: '2-digit' });
  const dd = d.toLocaleString('ja-JP', { timeZone: tz, day: '2-digit' });
  return `${y}-${m}-${dd}`;
}

(async () => {
  const date = process.env.DAILY_DATE || jstDateString();
  const repoRoot = process.cwd();
  const outDir = path.join(repoRoot, 'public', 'ogp');
  fs.mkdirSync(outDir, { recursive: true });

  const fileUrl = 'file://' + path.join(repoRoot, 'tools', 'ogp', 'daily.html');
  const url = `${fileUrl}?date=${encodeURIComponent(date)}`;
  const outPath = path.join(outDir, `daily-${date}.png`);

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.screenshot({ path: outPath });
  await browser.close();

  console.log(`OGP generated: ${path.relative(repoRoot, outPath)}`);
})();
