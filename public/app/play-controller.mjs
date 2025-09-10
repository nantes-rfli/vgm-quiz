// v1.12 Phase 2: play-controller (skeleton)
// 責務: タイマー（countdown）とタイムアウト時のコールバックのみを扱う。挙動不変。
// UIの描画や回答フローの本体は app.js 側（呼び出し側）に残す。
export function createPlayController({ document, onTimeout }) {
  let timerId = null;
  let remaining = 20;
  let enabled = false;

  function getCountdownEl() {
    try {
      return document.getElementById('countdown');
    } catch (_) {
      return null;
    }
  }

  function setTimerEnabled(flag) {
    enabled = !!flag;
  }

  function setDuration(sec) {
    const n = Number(sec);
    remaining = Number.isFinite(n) ? Math.max(0, n|0) : 20;
  }

  function isRunning() {
    return !!timerId;
  }

  function stop() {
    if (timerId) {
      try { clearInterval(timerId); } catch (_) {}
      timerId = null;
    }
  }

  function reset(sec = 20) {
    stop();
    setDuration(sec);
    const el = getCountdownEl();
    if (el) el.textContent = String(remaining);
  }

  function start() {
    const el = getCountdownEl();
    if (!el) return;
    stop(); // safety
    if (!enabled) {
      el.style.display = 'none';
      return;
    }
    el.style.display = 'block';
    el.textContent = String(remaining);
    timerId = setInterval(() => {
      remaining -= 1;
      if (remaining < 0) remaining = 0;
      try { el.textContent = String(remaining); } catch (_) {}
      if (remaining <= 0) {
        stop();
        try { onTimeout && onTimeout(); } catch (_) {}
      }
    }, 1000);
  }

  return {
    setTimerEnabled,
    setDuration,
    start,
    stop,
    reset,
    isRunning,
    getRemaining: () => remaining,
  };
}
