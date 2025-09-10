// play-controller.mjs
// v1.12 Phase2: timer & afterAnswer/accept/reject hooks (no behavior change)
// Keep this module DOM-free and UI-agnostic.

/**
 * @typedef {Object} PlayDeps
 * @property {(msg: any) => void} [logger]
 * @property {() => number} [now]
 */

/**
 * @typedef {Object} LivesWiring
 * @property {() => void} [recomputeMistakes]  // HUD再計算
 * @property {() => void} [maybeEndGameByLives] // 終了判定
 */

/**
 * @typedef {{correct?: boolean, remaining?: number}} AnswerPayload
 */


export function createPlayController(deps = {}) {
  const { logger = console, now = () => Date.now() } = deps;
  let intervalId = null;
  let deadline = 0;
  const hooks = { onTimeout: null, onAnswer: null, onNext: null, onAccept: null, onReject: null };
  // lives HUD & end-check (wired from app.js; kept optional)
  let _recomputeMistakes = null;
  let _maybeEndGameByLives = null;

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

  /** @param {number} durationMs */
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
  // Behavior-neutral: forward to optional hook only.
  function afterAnswer({ correct, remaining } = {}) {
    try {
      if (hooks.onAnswer) hooks.onAnswer({ correct, remaining });
    } catch (e) {
      try { logger && (logger.warn ? logger.warn(e) : logger.log(e)); } catch {}
    }
  }

  /** @param {(p: AnswerPayload) => void} cb */
  function onAnswer(cb) {
    hooks.onAnswer = cb;
  }
  /** @param {() => void} cb */
  function onNext(cb) {
    hooks.onNext = cb;
  }

  // Flow: accept/reject wrappers (behavior-neutral; only forward to hooks)
  /** @param {AnswerPayload} [payload] */
  function accept(payload = {}) {
    try {
      if (hooks.onAccept) hooks.onAccept(payload);
    } catch (e) {
      try { logger && (logger.warn ? logger.warn(e) : logger.log(e)); } catch {}
    }
  }
  /** @param {AnswerPayload} [payload] */
  function reject(payload = {}) {
    try {
      if (hooks.onReject) hooks.onReject(payload);
    } catch (e) {
      try { logger && (logger.warn ? logger.warn(e) : logger.log(e)); } catch {}
    }
  }
  /** @param {(p: AnswerPayload) => void} cb */
  function onAccept(cb) {
    hooks.onAccept = cb;
  }
  /** @param {(p: AnswerPayload) => void} cb */
  function onReject(cb) {
    hooks.onReject = cb;
  }

  // Flow entry: go to next question (callback is injected by app.js).
  function next() {
    try {
      if (hooks.onNext) hooks.onNext();
    } catch (e) {
      try { logger && (logger.warn ? logger.warn(e) : logger.log(e)); } catch {}
    }
  }

  // --- Lives wiring (DI) ---
  /**
   * @param {LivesWiring} param0
   */
  function wireLives({ recomputeMistakes, maybeEndGameByLives } = {}) {
    _recomputeMistakes = typeof recomputeMistakes === 'function' ? recomputeMistakes : null;
    _maybeEndGameByLives = typeof maybeEndGameByLives === 'function' ? maybeEndGameByLives : null;
  }
  // Keep behavior identical to historical sequence:
  // schedule recompute via setTimeout(0) and then invoke end-check sync.
  function refreshLives() {
    try {
      if (_recomputeMistakes) setTimeout(() => { try { _recomputeMistakes(); } catch(e) {} }, 0);
      if (_maybeEndGameByLives) _maybeEndGameByLives();
    } catch (e) {
      try { logger && (logger.warn ? logger.warn(e) : logger.log(e)); } catch {}
    }
  }

  return {
    start, stop, afterAnswer, onAnswer, onNext, next,
    accept, reject, onAccept, onReject,
    wireLives, refreshLives
  };
}

export default { createPlayController };
