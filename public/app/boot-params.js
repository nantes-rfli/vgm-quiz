// Extracted by v1.12 UI-slim Phase 1 (minimal).
/* global location */
const __SEARCH_PARAMS__ = new URLSearchParams(location.search);
const __IS_TEST_MODE__ = __SEARCH_PARAMS__.get('test') === '1';


// Early-set <html lang> for E2E and a11y (non-blocking; i18n.mjs will normalize later)
try {
  const __LANG__ = __SEARCH_PARAMS__.get('lang');
  if (__LANG__) {
    document.documentElement.setAttribute('lang', __LANG__);
  }
} catch {}

