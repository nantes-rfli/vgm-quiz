// v1.12 perf (optional): Delay non-critical version footer work
// 挙動不変。起動直後のメインスレッド負荷を避け、Idle/初回操作後に version.mjs を読み込みます。

const idle = (cb) => {
  if ('requestIdleCallback' in window) {
    requestIdleCallback(cb, { timeout: 2500 });
  } else {
    requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(cb, 0)));
  }
};

let armed = false;
function arm() {
  if (armed) return;
  armed = true;
  idle(() => {
    import('./version.mjs').catch(() => {});
  });
}

// 初回操作で確実に発火（軽量・単発）
['keydown','pointerdown','touchstart'].forEach(t =>
  window.addEventListener(t, arm, { once: true, passive: true })
);
// 何も操作されない場合でも、ある程度経ったら実行
arm();
