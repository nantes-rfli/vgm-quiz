/* public/app/auto_toast.mjs
 * AUTO mode ON toast & local setting.
 * Shows a small dismissible toast when ?auto=1 or settings.auto_enabled === true.
 * Accessibility: role="status", aria-live="polite"; respects prefers-reduced-motion.
 */

function isAutoEnabled() {
  const sp = new URLSearchParams(location.search);
  if (sp.get('auto') === '1' || sp.get('daily_auto') === '1') return true;
  try {
    const s = JSON.parse(localStorage.getItem('quiz-options') || '{}');
    if (s && s.auto_enabled === true) return true;
  } catch {}
  return false;
}

function shouldShowOncePerSession() {
  try {
    if (sessionStorage.getItem('auto_toast_shown') === '1') return false;
    sessionStorage.setItem('auto_toast_shown', '1');
  } catch {}
  return true;
}

function injectStyles() {
  if (document.getElementById('auto-toast-style')) return;
  const style = document.createElement('style');
  style.id = 'auto-toast-style';
  style.textContent = `
  #auto-toast-root{position:fixed;left:0;right:0;bottom:12px;display:flex;justify-content:center;pointer-events:none;z-index:2147483647}
  .auto-toast{pointer-events:auto;min-width:280px;max-width:92vw;padding:12px 14px;border-radius:10px;background:#111;color:#fff;box-shadow:0 8px 20px rgba(0,0,0,.35);font-size:14px;line-height:1.45}
  .auto-toast button{margin-left:12px}
  .sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
  @media (prefers-reduced-motion: no-preference) {
    .auto-toast{animation:autoToastIn .18s ease-out}
    .auto-toast.hide{animation:autoToastOut .16s ease-in forwards}
    @keyframes autoToastIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
    @keyframes autoToastOut{to{opacity:0;transform:translateY(6px)}}
  }`;
  document.head.appendChild(style);
}

function showToast() {
  if (!shouldShowOncePerSession()) return;
  injectStyles();

  let root = document.getElementById('auto-toast-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'auto-toast-root';
    root.setAttribute('aria-live', 'polite');
    document.body.appendChild(root);
  }

  const el = document.createElement('div');
  el.className = 'auto-toast';
  el.setAttribute('role','status');
  el.innerHTML = `
    <span>AUTOモードがONです<span class="sr-only">。Tab→Enterで回答できます。</span></span>
    <button type="button" aria-label="閉じる">OK</button>
  `;
  root.appendChild(el);

  const close = () => { el.classList.add('hide'); setTimeout(()=> el.remove(), 180); };
  el.querySelector('button')?.addEventListener('click', close);
  setTimeout(close, 4000);
}

(function bootstrap(){
  if (!isAutoEnabled()) return;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', showToast, { once: true });
  } else {
    showToast();
  }
})();

