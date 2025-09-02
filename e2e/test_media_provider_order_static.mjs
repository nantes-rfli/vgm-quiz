// e2e/test_media_provider_order_static.mjs
// Static smoke: media_player.mjs exposes provider dev flag and Apple/YouTube branches.
async function main(){
  const appUrl = process.env.APP_URL || 'https://nantes-rfli.github.io/vgm-quiz/app/';
  if (!appUrl.endsWith('/app/')) throw new Error('APP_URL must end with /app/');
  const res = await fetch(appUrl + 'media_player.mjs', { redirect: 'manual' });
  if (res.status !== 200) throw new Error('fetch failed: ' + res.status);
  const js = await res.text();
  const must = ['provider', 'apple-music-embed', 'apple-music-preview', 'youtube-embed', 'media-open-original'];
  const missing = must.filter(k => !js.includes(k));
  if (missing.length){
    console.log(js.slice(0, 400));
    throw new Error('media_player missing symbols: ' + missing.join(', '));
  }
  console.log('[media provider order static] OK');
}
main().catch(e => { console.error(e); process.exit(1); });

