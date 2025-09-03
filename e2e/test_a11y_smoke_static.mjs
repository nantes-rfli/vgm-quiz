// On-demand a11y static smoke (no browser).
// Checks markup for key ARIA attributes on the live site.
const base0 = process.env.APP_URL || 'https://nantes-rfli.github.io/vgm-quiz/app/?test=1&mock=1&autostart=0&lhci=1';
(async () => {
  const res = await fetch(base0, { headers: { 'Cache-Control': 'no-cache' } });
  const html = await res.text();

  function must(re, desc) {
    if (!re.test(html)) {
      console.error('[FAIL]', desc);
      process.exit(1);
    } else {
      console.log('[OK]', desc);
    }
  }

  must(/id="feedback"[^>]*role="status"[^>]*aria-live="polite"[^>]*aria-atomic="true"/s, '#feedback is a live region');
  must(/id="choices"[^>]*role="group"[^>]*aria-label="Choices"/s, '#choices has role=group');
  must(/id="choices"[^>]*aria-describedby="prompt"/s, '#choices is described by #prompt');
  must(/id="history-view"[^>]*role="region"[^>]*aria-labelledby="history-heading"/s, 'history is a region with labelledby');
  must(/id="result-view"[^>]*role="dialog"[^>]*aria-modal="true"/s, 'result is a modal dialog');

  console.log('A11y static smoke OK');
})();
