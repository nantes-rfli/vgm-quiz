/* daily index tools: search + today/prev nav (JST) */
(function () {
  'use strict';
  const $ = (s, p = document) => p.querySelector(s);
  const $$ = (s, p = document) => Array.from(p.querySelectorAll(s));
  const isTextLike = el => el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);

  function jstDateString(delta = 0) {
    const now = new Date();
    const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000); // UTC→JST
    jst.setUTCHours(0, 0, 0, 0);
    jst.setUTCDate(jst.getUTCDate() + delta);
    return jst.toISOString().slice(0, 10);
  }
  function jumpTo(dateStr) {
    location.href = `./${dateStr}.html`;
  }

  document.addEventListener('DOMContentLoaded', () => {
    let list =
      $('#daily-list') ||
      $('main ul') ||
      $('ul') ||
      $('ol');
    const lis = list ? $$('li', list) : [];

    // UI
    const wrap = document.createElement('div');
    wrap.id = 'daily-tools';
    wrap.style.marginTop = '1.5rem';
    wrap.setAttribute('role', 'region');
    wrap.setAttribute('aria-label', '日別一覧ツール');

    const input = document.createElement('input');
    input.type = 'search';
    input.placeholder = '検索（タイトル/ゲーム/作曲者/日付）';
    input.setAttribute('aria-label', '検索');
    input.style.padding = '0.5rem';
    input.style.minWidth = '280px';

    const todayBtn = document.createElement('button');
    todayBtn.textContent = '本日';
    const prevBtn = document.createElement('button');
    prevBtn.textContent = '前日';
    [todayBtn, prevBtn].forEach(b => {
      b.style.marginLeft = '0.5rem';
      b.style.padding = '0.5rem 0.75rem';
    });

    wrap.append(input, todayBtn, prevBtn);
    // リストの直前に差し込む（なければ <main> or body の末尾）
    const main = $('main') || document.body;
    if (list && list.parentNode) {
      list.parentNode.insertBefore(wrap, list);
    } else {
      main.appendChild(wrap);
    }
    // リストIDと aria-controls
    if (list && !list.id) {
      list.id = 'daily-list';
    }
    if (list) {
      input.setAttribute('aria-controls', list.id);
    }

    // 検索
    const norm = s => (s || '').toLowerCase();
    input.addEventListener('input', () => {
      const term = norm(input.value.trim());
      if (!list) return;
      lis.forEach(li => {
        const t = norm(li.textContent);
        li.style.display = term ? (t.includes(term) ? '' : 'none') : '';
      });
    });

    // ナビ
    todayBtn.addEventListener('click', () => jumpTo(jstDateString(0)));
    prevBtn.addEventListener('click', () => jumpTo(jstDateString(-1)));

    // 事前フィルタ (?q=...) を反映
    const pre = new URL(location.href).searchParams.get('q');
    if (pre) {
      input.value = pre;
      input.dispatchEvent(new Event('input'));
    }

    // ショートカット: "/" で検索にフォーカス
    document.addEventListener('keydown', (e) => {
      if (e.key === '/' && !e.altKey && !e.ctrlKey && !e.metaKey) {
        if (!isTextLike(document.activeElement)) {
          e.preventDefault();
          input.focus();
          input.select();
        }
      }
    });

    // Enter: 一件のみヒットならそのリンクへ
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const visible = lis.filter(li => li.style.display !== 'none');
        if (visible.length === 1) {
          const a = visible[0].querySelector('a');
          if (a && a.href) location.href = a.href;
        }
      }
    });
  });
})();
