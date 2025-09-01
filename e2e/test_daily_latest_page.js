// e2e/test_daily_latest_page.js
// Smoke test: /daily/latest.html?no-redirect=1 renders and contains expected markers.
async function main() {
  const appUrl = process.env.APP_URL || 'https://nantes-rfli.github.io/vgm-quiz/app/';
  if (!appUrl.endsWith('/app/')) throw new Error(`APP_URL must end with '/app/' (got: ${appUrl})`);
  const dailyBase = appUrl.replace('/app/', '/daily/');
  const url = `${dailyBase}latest.html?no-redirect=1`;

  console.log('[E2E daily latest] URL =', url);
  const res = await fetch(url, { redirect: 'manual' });
  if (res.status !== 200) throw new Error(`unexpected status: ${res.status}`);
  const html = await res.text();
  const hints = [
    'location.replace(',
    'AUTOで遊ぶ',
    '<link rel="canonical" href="../app/?daily=',
  ];
  if (!hints.some(h => html.includes(h))) {
    console.error(html.slice(0, 1200));
    throw new Error('expected markers not found in latest page');
  }
  console.log('[E2E daily latest] OK');
}
main().catch(e => { console.error(e); process.exit(1); });
