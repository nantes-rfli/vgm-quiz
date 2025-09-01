// e2e/test_daily_share_page.js
// Smoke test: /daily/YYYY-MM-DD.html?no-redirect=1 renders and contains expected markers.
async function main() {
  const appUrl = process.env.APP_URL || 'https://nantes-rfli.github.io/vgm-quiz/app/';
  if (!appUrl.endsWith('/app/')) throw new Error(`APP_URL must end with '/app/' (got: ${appUrl})`);
  const jstFmt = new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' });
  const jstDate = jstFmt.format(new Date()).replaceAll('/', '-').replace(/^([0-9]{4})-([0-9]{2})-([0-9]{2})$/, (_, y, m, d) => `${y}-${m}-${d}`);
  const dailyBase = appUrl.replace('/app/', '/daily/');
  const shareUrl = `${dailyBase}${jstDate}.html?no-redirect=1`;

  console.log('[E2E daily share] URL =', shareUrl);
  const res = await fetch(shareUrl, { redirect: 'manual' });
  if (res.status !== 200) throw new Error(`unexpected status: ${res.status}`);
  const html = await res.text();
  const hints = [
    'location.replace(',
    'AUTOで遊ぶ',
    `<link rel="canonical" href="../app/?daily=${jstDate}">`,
  ];
  if (!hints.some(h => html.includes(h))) {
    console.error(html.slice(0, 1200));
    throw new Error('expected markers not found in share page');
  }
  console.log('[E2E daily share] OK');
}
main().catch(e => { console.error(e); process.exit(1); });
