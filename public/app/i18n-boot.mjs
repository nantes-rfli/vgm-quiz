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

// DOMの変化を監視して i18n を適用（rAFデバウンス＋再入防止）
let __i18nApplying = false;
let __i18nScheduled = false;
function scheduleI18nApply() {
  if (__i18nScheduled) return;
  __i18nScheduled = true;
  const raf = window.requestAnimationFrame || (cb => setTimeout(cb, 16));
  raf(() => {
    __i18nScheduled = false;
    if (__i18nApplying) return; // すでに実行中なら次フレームへ委譲
    __i18nApplying = true;
    try {
      __applyStaticAll();
    } finally {
      __i18nApplying = false;
    }
  });
}
const mo = new MutationObserver(muts => {
  // 無関係な属性変更は無視して負荷を下げる
  const interesting = muts.some(m => m.type === 'childList' || (m.type === 'attributes' && /^(lang|dir|data-i18n)/.test(m.attributeName || '')));
  if (interesting) scheduleI18nApply();
});
mo.observe(document.documentElement, { subtree:true, childList:true, attributes:true, attributeFilter:['lang','dir'] });
// 初回適用も同一経路で
scheduleI18nApply();
