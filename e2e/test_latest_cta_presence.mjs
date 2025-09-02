// e2e/test_latest_cta_presence.mjs
// Assert that /daily/latest.html?no-redirect=1 includes a CTA link to the app (#cta-latest-app).
async function main() {
  const appUrl = process.env.APP_URL || 'https://nantes-rfli.github.io/vgm-quiz/app/';
  if (!appUrl.endsWith('/app/')) throw new Error(`APP_URL must end with '/app/' (got: ${appUrl})`);
  const dailyBase = appUrl.replace('/app/', '/daily/');
  const url = `${dailyBase}latest.html?no-redirect=1`;
  console.log('[E2E latest cta] URL =', url);

  const res = await fetch(url, { redirect: 'manual' });
  if (res.status !== 200) throw new Error(`unexpected status: ${res.status}`);
  const html = await res.text();

  const hasId = html.includes('id="cta-latest-app"');
  const hasText = html.toLowerCase().includes('アプリで今日の1問へ');
  if (!hasId && !hasText) {
    console.log(html.slice(0, 400));
    throw new Error('#cta-latest-app CTA not found in latest.html');
  }
  console.log('[E2E latest cta] ok');
}
main().catch(err => {
  console.error(err);
  process.exit(1);
});
