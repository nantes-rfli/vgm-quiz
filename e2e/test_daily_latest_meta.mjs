// e2e/test_daily_latest_meta.mjs
// Assert that /daily/latest.html?no-redirect=1 contains <meta name="description"> in <head>
async function main() {
  const appUrl = process.env.APP_URL || 'https://nantes-rfli.github.io/vgm-quiz/app/';
  if (!appUrl.endsWith('/app/')) throw new Error(`APP_URL must end with '/app/' (got: ${appUrl})`);
  const dailyBase = appUrl.replace('/app/', '/daily/');
  const url = `${dailyBase}latest.html?no-redirect=1`;

  console.log('[E2E latest meta] URL =', url);
  const res = await fetch(url, { redirect: 'manual' });
  if (res.status !== 200) throw new Error(`unexpected status: ${res.status}`);
  const html = await res.text();

  const headStart = html.indexOf('<head>');
  const headEnd = html.indexOf('</head>');
  if (headStart < 0 || headEnd < 0 || headEnd <= headStart) {
    throw new Error('head tag not found');
  }
  const head = html.slice(headStart, headEnd).toLowerCase();
  const hasMeta = head.includes('<meta name="description"');
  if (!hasMeta) {
    const snippet = html.slice(0, 400);
    console.log('[E2E latest meta] head snippet:', head.slice(0, 200));
    throw new Error('meta[name="description"] not found in head');
  }
  console.log('[E2E latest meta] ok');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
