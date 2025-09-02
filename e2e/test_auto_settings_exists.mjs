// e2e/test_auto_settings_exists.mjs
// Assert that Start view contains the AUTO settings checkbox (id="auto-enabled").
async function main() {
  const appUrl = process.env.APP_URL || 'https://nantes-rfli.github.io/vgm-quiz/app/';
  if (!appUrl.endsWith('/app/')) throw new Error(`APP_URL must end with '/app/' (got: ${appUrl})`);
  const url = `${appUrl}?test=1`;
  console.log('[E2E auto settings] URL =', url);
  const res = await fetch(url, { redirect: 'manual' });
  if (res.status !== 200) throw new Error(`unexpected status: ${res.status}`);
  const html = await res.text();
  if (!html.includes('id="auto-enabled"')) {
    console.log(html.slice(0, 300));
    throw new Error('AUTO settings checkbox not found');
  }
  console.log('[E2E auto settings] ok');
}
main().catch(err => {
  console.error(err);
  process.exit(1);
});

