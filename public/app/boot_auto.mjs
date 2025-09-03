// Conditionally load auto-mode helpers to avoid cost when unused.
const params = new URLSearchParams(location.search || '');
const isAuto = params.get('auto') === '1' || params.get('daily_auto') === '1';

if (isAuto) {
  // Load in parallel; they are independent and small.
  await Promise.all([
    import('./auto_choices_loader.mjs'),
    import('./auto_badge.mjs'),
    import('./auto_toast.mjs')
  ]).catch(e => console.warn('[auto] boot load failed', e));
}

