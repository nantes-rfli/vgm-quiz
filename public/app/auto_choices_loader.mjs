// Load daily_auto.json and expose today's pick (and its choices) on window
// Enabled only when ?auto=1 or ?daily_auto=1 is present.
// Index.html loads this before mc.js so that generateChoices can consult it.

import { normalize as normalizeV2 } from './normalize.mjs';

function isEnabled() {
  const sp = new URLSearchParams(location.search);
  return sp.get('auto') === '1' || sp.get('daily_auto') === '1';
}
function isForceAny() {
  const sp = new URLSearchParams(location.search);
  return sp.get('auto_any') === '1';
}

function todayJST() {
  // get YYYY-MM-DD in JST
  const now = new Date();
  const tzNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  const y = tzNow.getFullYear();
  const m = String(tzNow.getMonth() + 1).padStart(2, '0');
  const d = String(tzNow.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function requestedDate() {
  const sp = new URLSearchParams(location.search);
  const d = sp.get('daily');
  if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  if (d === '1') return todayJST();
  return todayJST();
}

async function loadAuto() {
  try {
    const res = await fetch('./daily_auto.json', { cache: 'no-store' });
    if (!res.ok) return null;
    const j = await res.json();
    return j;
  } catch (e) {
    console.warn('[auto-choices] failed to load daily_auto.json', e);
    return null;
  }
}

function norm(s) {
  try { return normalizeV2(String(s)); }
  catch { return String(s || '').normalize('NFKC').trim().toLowerCase(); }
}

async function bootstrap() {
  if (!isEnabled()) return;
  const j = await loadAuto();
  if (!j || !j.by_date) return;
  const date = requestedDate();
  const entry = j.by_date[date];
  if (!entry) return;
  // store raw entry for mc.js to match canonically (alias-aware)
  window.__DAILY_AUTO_CHOSEN = entry;
  if (isForceAny()) {
    window.__DAILY_AUTO_FORCE = true;
  }
  // Also expose a normalized fallback key for debugging/helpers
  window.__DAILY_AUTO_KEY_NORM = `${norm(entry.title)}|${norm(entry.game)}|${norm(entry.composer)}`;
  // Notify app that a daily-auto pick is ready (for race-free rewiring)
  try {
    window.dispatchEvent(new CustomEvent('daily-auto-ready', { detail: { date, entry } }));
  } catch (_) {}
  console.log('[auto-choices] loaded for', date, entry.title, '/', entry.game, isForceAny() ? '(FORCE any)' : '');
}

bootstrap();

