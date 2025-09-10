// A11y helpers extracted by v1.12 UI-slim Phase 1
export function initA11y() {
  const once = (fn) => {
    let done = false;
    return (...args) => {
      if (!done) {
        done = true;
        fn(...args);
      }
    };
  };

  const ensureTimerAria = () => {
    const t = document.querySelector('[data-testid="timer"], #timer');
    if (!t) return;
    if (!t.getAttribute('aria-live')) t.setAttribute('aria-live', 'polite');
    if (!t.getAttribute('aria-atomic')) t.setAttribute('aria-atomic', 'true');
  };

  const ensureProgressbarAria = () => {
    const bar = document.querySelector('[data-testid="score-bar"], #score-bar');
    if (!bar) return;
    bar.setAttribute('role', 'progressbar');
    bar.setAttribute('aria-valuemin', '0');
    bar.setAttribute('aria-valuemax', '100');
    const updateNow = () => {
      // 期待: style="width: NN%"
      const w = (bar.style && bar.style.width) || '';
      const m = w.match(/(\d+(?:\.\d+)?)%/);
      if (m) bar.setAttribute('aria-valuenow', String(Math.round(parseFloat(m[1]))));
    };
    updateNow();
    // 変化を監視して now を追従（重複バインド防止）
    if (!bar.dataset._a11yProgressMoBound) {
      const mo = new MutationObserver(() => updateNow());
      mo.observe(bar, { attributes: true, attributeFilter: ['style'] });
      bar.dataset._a11yProgressMoBound = '1';
    }
  };

  const annotateChoices = () => {
    const container = document.querySelector('#choices') || document.querySelector('[data-testid="choices"]');
    if (!container) return;
    container
      .querySelectorAll('button, .choice, [data-testid="choice"]')
      .forEach((el) => {
        el.setAttribute('role', 'button'); // button要素でも冗長OK
        if (!el.hasAttribute('aria-pressed')) el.setAttribute('aria-pressed', 'false');
      });
    // クリックで aria-pressed をトグル（選択反映）: 重複バインド防止
    if (!container.dataset._a11yChoiceBound) {
      container.addEventListener(
        'click',
        (e) => {
          const target = e.target.closest('button, .choice, [data-testid="choice"]');
          if (!target) return;
          container
            .querySelectorAll('button, .choice, [data-testid="choice"]')
            .forEach((el) => {
              el.setAttribute('aria-pressed', el === target ? 'true' : 'false');
            });
        },
        { passive: true },
      );
      container.dataset._a11yChoiceBound = '1';
    }
  };

  const focusFirstControl = once(() => {
    // Free: answer、MC: 最初の選択肢
    const answer = document.querySelector('[data-testid="answer"], #answer');
    if (answer) {
      answer.focus?.();
      return;
    }
    const firstChoice = document.querySelector('#choices button, .choice, [data-testid="choice"]');
    firstChoice?.focus?.();
  });

  const observeQuiz = () => {
    const quizView =
      document.querySelector('#question-view') ||
      document.querySelector('[data-testid="quiz-view"]');
    if (!quizView) return;
    // 出題レンダ後にA11yを適用（属性変化は監視しない＝自己再帰ループ回避）
    const apply = () => {
      ensureTimerAria();
      ensureProgressbarAria();
      annotateChoices();
      focusFirstControl();
    };
    const mo = new MutationObserver((mutations) => {
      if (mutations.some((m) => m.type === 'childList')) apply();
    });
    mo.observe(quizView, { childList: true, subtree: true }); // attributes: false
    apply();
  };

  window.addEventListener(
    'DOMContentLoaded',
    () => {
      // Start押下後にもフォーカスが飛ぶよう保険
      const startBtn = document.querySelector('[data-testid="start-btn"], #start-btn');
      if (startBtn)
        startBtn.addEventListener(
          'click',
          () => setTimeout(() => focusFirstControl(), 0),
          { once: true },
        );
      observeQuiz();
      // 初期描画時にも最低限のA11yを適用
      ensureTimerAria();
      ensureProgressbarAria();
      focusFirstControl();
    },
    { once: true },
  );
}

