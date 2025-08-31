// デイリーモードでの共有URLを /daily/YYYY-MM-DD.html に置き換えるパッチ。
// 既存の copyToClipboard を安全に横取りし、トースト等の挙動は既存ロジックに委ねる。
(function () {
  function getQP(k) {
    try { return new URLSearchParams(location.search).get(k); } catch { return null; }
  }
  function resolveDailyDate() {
    const q = getQP('daily');
    return (q && /^\d{4}-\d{2}-\d{2}$/.test(q)) ? q : null;
  }
  function publicBase() {
    // /vgm-quiz/app/... -> /vgm-quiz
    const m = location.pathname.match(/^(.*)\/app(?:\/.*)?$/);
    const basePath = m ? m[1] : '';
    return location.origin + basePath;
  }
  function buildDailyShareUrl(date) {
    return `${publicBase()}/daily/${date}.html`;
  }
  function applyOverride() {
    const date = resolveDailyDate();
    if (!date) return; // 非デイリー時は何もしない
    const original = window.copyToClipboard;
    window.copyToClipboard = async function (text) {
      const url = buildDailyShareUrl(date);
      if (typeof original === 'function') {
        return original(url); // 既存のトースト/通知はそのまま活用
      }
      // フォールバック
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(url);
        } else {
          const ta = document.createElement('textarea');
          ta.value = url; document.body.appendChild(ta);
          ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
        }
      } catch (e) { console.error('share_patch copy failed', e); }
    };
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyOverride, { once: true });
  } else {
    applyOverride();
  }
})();
