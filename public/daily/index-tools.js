/* daily index tools: search + today/prev nav (JST) */
(function () {
  'use strict';
  const $ = (s, p = document) => p.querySelector(s);
  const $$ = (s, p = document) => Array.from(p.querySelectorAll(s));
  function jstDateString(delta = 0) {
    const now = new Date();
    const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    jst.setUTCHours(0, 0, 0, 0);
    jst.setUTCDate(jst.getUTCDate() + delta);
    return jst.toISOString().slice(0, 10);
  }
  function jumpTo(dateStr) { location.href = `./${dateStr}.html`; }
  document.addEventListener('DOMContentLoaded', () => {
    const list = $('#daily-list') || $('main ul') || $('ul') || $('ol');
    const lis = list ? $$('li', list) : [];
    const wrap = document.createElement('div'); wrap.id = 'daily-tools'; wrap.style.marginTop = '1.5rem';
    const input = document.createElement('input'); input.type = 'search'; input.placeholder = '検索（タイトル/ゲーム/作曲者/日付）'; input.setAttribute('aria-label','検索'); input.style.padding='0.5rem'; input.style.minWidth='280px';
    const todayBtn = document.createElement('button'); todayBtn.textContent='本日';
    const prevBtn = document.createElement('button'); prevBtn.textContent='前日';
    [todayBtn, prevBtn].forEach(b => { b.style.marginLeft='0.5rem'; b.style.padding='0.5rem 0.75rem'; });
    wrap.append(input, todayBtn, prevBtn); document.body.appendChild(wrap);
    const norm = s => (s || '').toLowerCase();
    input.addEventListener('input', () => {
      const term = norm(input.value.trim());
      if (!list) return;
      lis.forEach(li => { const t = norm(li.textContent); li.style.display = term ? (t.includes(term) ? '' : 'none') : ''; });
    });
    todayBtn.addEventListener('click', () => jumpTo(jstDateString(0)));
    prevBtn.addEventListener('click', () => jumpTo(jstDateString(-1)));
  });
})();
