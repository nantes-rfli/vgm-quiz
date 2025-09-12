// v1.12 perf: 非クリティカル初期処理をアイドル/初回操作後に遅延実行
// 挙動不変（UI/文言/機能は変更しない）。LH の MPFID/TBT の圧縮を狙う。

const idle = (cb) => {
  if ('requestIdleCallback' in window) {
    requestIdleCallback(cb, { timeout: 2500 });
  } else {
    // rAF 2 フレーム + setTimeout でほぼアイドル相当へ
    requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(cb, 0)));
  }
};

let armed = false;
const arm = () => {
  if (armed) return;
  armed = true;
  idle(async () => {
    try {
      // いずれも副作用が軽い順に評価
      // 1) 版数フッターの埋め込み（UI 可用化後で十分）
      await import('./version.mjs').catch(() => {});
      // 2) Service Worker の更新確認は sw_update.js 側で遅延実行
      // （ここでは何もしない）
    } catch {
      // no-op: 遅延系は失敗しても致命ではない
    }
  });
};

// 初回操作で確実に発火（キーボード/マウス/タッチ）
['keydown','pointerdown','touchstart'].forEach(t =>
  window.addEventListener(t, arm, { once: true, passive: true })
);
// 何も操作されない場合でも、起動から少し経てば実行
arm();
