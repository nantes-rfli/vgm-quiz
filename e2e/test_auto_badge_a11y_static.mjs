// e2e/test_auto_badge_a11y_static.mjs
// Static check: public/app/auto_badge.mjs contains a11y attributes for the badge.
async function main() {
  const appUrl = process.env.APP_URL || 'https://nantes-rfli.github.io/vgm-quiz/app/';
  if (!appUrl.endsWith('/app/')) throw new Error(`APP_URL must end with '/app/' (got: ${appUrl})`);
  const url = `${appUrl}auto_badge.mjs`;
  console.log('[E2E auto badge a11y] URL =', url);

  const res = await fetch(url, { redirect: 'manual' });
  if (res.status !== 200) throw new Error(`unexpected status: ${res.status}`);
  const js = await res.text();
  const must = ['role', 'aria-live', 'aria-label'];
  const missing = must.filter(s => !js.includes(s));
  if (missing.length) {
    console.log(js.slice(0, 400));
    throw new Error('auto_badge.mjs missing a11y attributes: ' + missing.join(', '));
  }
  console.log('[E2E auto badge a11y] ok');
}
main().catch(err => { console.error(err); process.exit(1); });
