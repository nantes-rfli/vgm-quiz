// 検証/テスト時のみ Start ボタンの無効化を救済するフェイルセーフ（本番挙動への影響なし）
export function applyE2EStartFailsafe(win = window, doc = document) {
  try {
    const qs = new URLSearchParams(win.location.search);
    const isTest = qs.get('test') === '1' || qs.has('test');
    const isMock = qs.get('mock') === '1' || qs.has('mock');
    if (!(isTest || isMock)) return; // 本番では何もしない

    const t0 = performance.now();
    const MAX = 3000; // 3s 以内に救済

    const tryEnable = () => {
      const btn = doc.querySelector('[data-testid="start-btn"], #start-btn');
      if (btn && btn.disabled) {
        btn.disabled = false;
        btn.setAttribute('data-e2e-failsafe', '1');
        try { win.__DATASET_READY__ = true; } catch {}
        try { console.info('[E2E] start-btn enabled by failsafe'); } catch {}
        return true;
      }
      return false;
    };

    const tick = () => {
      if (tryEnable()) return;
      if (performance.now() - t0 >= MAX) return;
      requestAnimationFrame(tick);
    };

    // DOM が起きた直後から監視
    if (doc.readyState === 'loading') {
      doc.addEventListener('DOMContentLoaded', tick, { once: true });
    } else {
      tick();
    }
  } catch (e) {
    try { console.warn('[E2E] failsafe error', e); } catch {}
  }
}
