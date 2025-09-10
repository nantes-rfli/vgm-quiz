// play-controller.mjs
// v1.12 Phase2: timer & afterAnswer hook (no behavior change)
// Keep this module DOM-free and UI-agnostic.

export function createPlayController(deps = {}) {
  const { logger = console, now = () => Date.now() } = deps;
  let intervalId = null;
  let deadline = 0;
  const hooks = { onTimeout: null, onAnswer: null, onNext: null };

  function tick() {
    const remain = deadline - now();
    if (remain <= 0) {
      stop();
      try {
        if (hooks.onTimeout) hooks.onTimeout();
      } catch (e) {
        try { logger && (logger.warn ? logger.warn(e) : logger.log(e)); } catch {}
      }
    }
  }

  function start(durationMs, opts = {}) {
    stop();
    deadline = now() + (durationMs | 0);
    if (opts.onTimeout) hooks.onTimeout = opts.onTimeout;
    intervalId = setInterval(tick, 200);
  }

  function stop() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  // New in Phase2: called by app.js right after an answer is submitted.
  // This is a NO-OP in terms of behavior; it only forwards to an optional hook.
  function afterAnswer({ correct, remaining } = {}) {
    try {
      if (hooks.onAnswer) hooks.onAnswer({ correct, remaining });
    } catch (e) {
      try { logger && (logger.warn ? logger.warn(e) : logger.log(e)); } catch {}
    }
  }

  function onAnswer(cb) {
    hooks.onAnswer = cb;
  }
  function onNext(cb) {
    hooks.onNext = cb;
  }

  // Flow entry: go to next question (callback is injected by app.js).
  function next() {
    try {
      if (hooks.onNext) hooks.onNext();
    } catch (e) {
      try { logger && (logger.warn ? logger.warn(e) : logger.log(e)); } catch {}
    }
  }

  return { start, stop, afterAnswer, onAnswer, onNext, next };
}

export default { createPlayController };
