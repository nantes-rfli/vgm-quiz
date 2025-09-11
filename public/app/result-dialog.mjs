// Result dialog & share helpers extracted by v1.12 UI-slim Phase 2

// Depends only on DOM APIs and a provided share-text builder callback.

/**
 * 結果サマリーを描画（UIロジックのみ；データ加工は呼び出し側で完了している前提）
 * @param {Array} questions - 出題配列（{type, correct, answer, track:{year,game}, elapsed} を想定）
 * @param {Object} TYPE_LABELS - タイプごとの表示ラベル
 * @param {HTMLElement} [listEl=document.getElementById('summary-list')]
 */
function renderResultSummary(questions, TYPE_LABELS, listEl = document.getElementById('summary-list')) {
  if (!Array.isArray(questions)) return;
  if (!listEl) return;
  listEl.innerHTML = '';
  for (const q of questions) {
    const li = document.createElement('li');
    const mark = q && q.correct ? '✅' : '❌';
    const ans = q && q.answer != null ? String(q.answer) : '';
    const year = q && q.track && q.track.year != null ? q.track.year : '';
    const game = q && q.track && q.track.game != null ? q.track.game : '';
    const elapsed = (q && q.elapsed != null ? q.elapsed : '').toString();
    const typeLabel = TYPE_LABELS && q ? (TYPE_LABELS[q.type] ?? String(q.type)) : '';
    li.textContent = `${typeLabel} - ${mark} - ${ans} - ${year} - ${game} - ${elapsed}s`;
    listEl.appendChild(li);
  }
}

let _copyToastTimer = null;

async function copyToClipboard(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    const toast = document.getElementById('copy-toast');
    if (toast) {
      toast.textContent = 'コピーしました';
      toast.setAttribute('aria-live', 'polite');
      // 数秒で自動クリア（多重クリックにも対応）
      if (_copyToastTimer) clearTimeout(_copyToastTimer);
      _copyToastTimer = setTimeout(() => {
        toast.textContent = '';
        _copyToastTimer = null;
      }, 2000);
    }
  } catch (e) {
    alert('コピーに失敗しました: ' + e.message);
  }
}

function canonicalAppUrl() {
  // 現在の URL から検証用クエリを取り除いた共有用URLを返す
  try {
    const u = new URL(location.href);
    const rm = ['test','mock','autostart','lhci','debug'];
    rm.forEach(k => u.searchParams.delete(k));
    return u.toString();
  } catch {
    return location.origin + location.pathname;
  }
}

function setupResultShare(buildResultShareText) {
  const copyBtn = document.getElementById('copy-result-btn');
  const shareBtn = document.getElementById('share-result-btn');
  const toast = document.getElementById('copy-toast');
  if (toast) toast.textContent = ''; // 直前の表示をリセット
  if (!copyBtn || !shareBtn) return;
  if (!copyBtn.dataset._bound) {
    copyBtn.addEventListener('click', async () => {
      await copyToClipboard(buildResultShareText());
    }, { passive: true });
    copyBtn.dataset._bound = '1';
  }
  // Web Share API がある環境だけ Share を出す
  if (typeof navigator.share === 'function') {
    shareBtn.style.display = '';
    if (!shareBtn.dataset._bound) {
      shareBtn.addEventListener('click', async () => {
        const text = buildResultShareText();
        try { await navigator.share({ title: 'VGM Quiz', text, url: canonicalAppUrl() }); }
        catch (e) {
          // キャンセル等は無視。それ以外はコピーにフォールバック
          if (e && e.name !== 'AbortError') await copyToClipboard(text);
        }
      }, { passive: true });
      shareBtn.dataset._bound = '1';
    }
  } else {
    shareBtn.style.display = 'none';
  }
}

// --- Result dialog A11y: focus trap / initial focus / ESC close ---
let _resultDialogPrevFocus = null;
let _resultDialogKeydown = null;

function focusablesIn(node) {
  const sel = [
    'a[href]', 'button:not([disabled])', 'input:not([disabled])',
    'select:not([disabled])', 'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(',');
  return Array.from(node.querySelectorAll(sel)).filter(el => {
    const s = getComputedStyle(el);
    return s.visibility !== 'hidden' && s.display !== 'none';
  });
}

function openResultDialogA11y() {
  const dlg = document.getElementById('result-view');
  if (!dlg) return;
  // 保存：開く前のフォーカス
  _resultDialogPrevFocus = document.activeElement;
  // 初期フォーカス（コピー > 共有 > リスタート の優先）
  const first =
    document.getElementById('copy-result-btn') ||
    document.getElementById('share-result-btn') ||
    document.getElementById('restart-btn') ||
    dlg;
  first.focus();
  // Announce dialog opened
  try {
    const live = document.getElementById('feedback');
    if (live) live.textContent = t('a11y.resultsShown');
  } catch {}
  // ---- a11y hardening: background inert + scroll lock ----
  try {
    const main = document.getElementById('main') || dlg.parentElement;
    if (main) {
      Array.from(main.children).forEach((el) => {
        if (el !== dlg) {
          el.setAttribute('aria-hidden', 'true');
          // inert prevents focus & events on background; supported in Chromium, Safari
          // (attribute form is fine; property may not exist in older engines)
          el.setAttribute('inert', '');
        }
      });
      // mark for cleanup
      dlg.dataset._a11yInertApplied = '1';
    }
    // Prevent background scroll while modal is open
    document.documentElement.classList.add('modal-open');
    document.body && (document.body.style.overflow = 'hidden');
  } catch (_) {}
  // Tabトラップ
  _resultDialogKeydown = (ev) => {
    if (ev.key === 'Tab') {
      const list = focusablesIn(dlg);
      if (!list.length) return;
      const first = list[0], last = list[list.length - 1];
      if (ev.shiftKey && document.activeElement === first) {
        last.focus(); ev.preventDefault();
      } else if (!ev.shiftKey && document.activeElement === last) {
        first.focus(); ev.preventDefault();
      }
    } else if (ev.key === 'Escape' || ev.key === 'Esc') {
      // Escで結果を閉じて Start に戻す（安全に戻れない場合はフォーカスだけ返す）
      closeResultDialogA11y(true);
    }
  };
  dlg.addEventListener('keydown', _resultDialogKeydown);
  // 念のため属性を強化
  dlg.setAttribute('aria-modal', 'true');
  dlg.setAttribute('role', 'dialog');
  dlg.setAttribute('tabindex', '-1');
}

function closeResultDialogA11y(goStart = false) {
  const dlg = document.getElementById('result-view');
  if (dlg && _resultDialogKeydown) {
    dlg.removeEventListener('keydown', _resultDialogKeydown);
  }
  _resultDialogKeydown = null;
  // ---- a11y hardening cleanup: remove inert/aria-hidden & unlock scroll ----
  try {
    if (dlg && dlg.dataset._a11yInertApplied) {
      const main = document.getElementById('main') || dlg.parentElement;
      if (main) {
        Array.from(main.children).forEach((el) => {
          if (el !== dlg) {
            el.removeAttribute('aria-hidden');
            el.removeAttribute('inert');
          }
        });
      }
      delete dlg.dataset._a11yInertApplied;
    }
    document.documentElement.classList.remove('modal-open');
    document.body && (document.body.style.overflow = '');
  } catch (_) {}
  // Announce dialog closed / ready
  try {
    const live = document.getElementById('feedback');
    if (live) live.textContent = t('a11y.ready');
  } catch {}
  // 戻り先：Startビュー or 直前フォーカス
  if (goStart) {
    try {
      showView('start-view');
      const sb = document.getElementById('start-btn') || document.querySelector('[data-testid="start-btn"]');
      sb?.focus();
      return;
    } catch (_) {}
  }
  if (_resultDialogPrevFocus && _resultDialogPrevFocus.focus) {
    _resultDialogPrevFocus.focus();
  }
  _resultDialogPrevFocus = null;
}

export { renderResultSummary, copyToClipboard, canonicalAppUrl, setupResultShare, openResultDialogA11y, closeResultDialogA11y };

