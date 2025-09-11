import { initI18n, whenI18nReady, applyStaticLabels, seedLiveRegion } from './i18n.mjs';
import { applyE2EStartFailsafe } from './e2e-failsafe.mjs';

// Early i18n boot so static labels are localized before app logic runs.
await initI18n();
await whenI18nReady();
applyStaticLabels(document);
seedLiveRegion(document);

// E2E/検証時のみ：Start ボタンの無効化取り残しを救済
applyE2EStartFailsafe();

// Re-apply immediately when language flips (setLang -> 'i18n:changed').
function __applyStaticAll() {
  try { applyStaticLabels(document); } catch {}
  try { seedLiveRegion(document); } catch {}
}
window.addEventListener('i18n:changed', __applyStaticAll);

// Ensure DOM is present for static nodes created after init (e.g., Start button)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', __applyStaticAll, { once: true });
}

// Short bootstrap observation window: if components mount after init,
// localize them using the canonical locales/*.json via applyStaticLabels.
(function __i18nBootstrapObserve(){
  try {
    const stopAt = Date.now() + 3000;
    const mo = new MutationObserver(() => {
      __applyStaticAll();
      if (Date.now() > stopAt) { try { mo.disconnect(); } catch {} }
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(() => { try { mo.disconnect(); } catch {} }, 3500);
  } catch {}
})();
