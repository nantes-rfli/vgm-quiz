// i18n baseline (v1.6)
import { initI18n, whenI18nReady, applyStaticLabels, t } from './i18n.mjs';
void initI18n(); // non-blocking; updates <html lang> & document.title
whenI18nReady().then(() => {
  // Try immediately, then after first paint, then once again after 500ms for safety
  try { applyStaticLabels(); } catch {}
  try { requestAnimationFrame(() => applyStaticLabels()); } catch {}
  setTimeout(() => { try { applyStaticLabels(); } catch {} }, 500);
  // Initialize live region text
  try {
    const live = document.getElementById('feedback');
    if (live && !live.textContent?.trim()) {
      live.textContent = t('a11y.ready');
    }
  } catch {}
});
// Re-apply on language change (future-proofing)
window.addEventListener('i18n:changed', () => {
  try { applyStaticLabels(); } catch {}
  try {
    const live = document.getElementById('feedback');
    if (live) live.textContent = t('a11y.ready');
  } catch {}
});

export function installI18nBoot() {
  // no-op wrapper: the code above runs on import; this export keeps ESM explicit.
}
