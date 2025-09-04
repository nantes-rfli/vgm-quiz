/* Lightweight i18n core for v1.6 (Baseline)
 * - en is embedded (no network on first load)
 * - other locales (e.g., ja) are fetched on demand from /public/app/locales/<lang>.json
 * - detection priority: ?lang=xx > localStorage(lang) > navigator.language > 'en'
 */

/* eslint-disable no-console */

const SUPPORTED = ['en', 'ja'];
const DEFAULT_LANG = 'en';

// Embedded EN dictionary to avoid extra request on first paint.
const EMBEDDED_EN = {
  app: {
    title: 'VGM Quiz',
  },
  ui: {
    start: 'Start',
    history: 'History',
    share: 'Share',
  },
  a11y: {
    ready: 'Ready. Press Start to begin.',
  },
};

let currentLang = DEFAULT_LANG;
let dict = EMBEDDED_EN;
let _initPromise = null;

function normalizeLang(raw) {
  if (!raw) return DEFAULT_LANG;
  const lc = String(raw).toLowerCase();
  // map like ja-JP -> ja
  const base = lc.split('-')[0];
  return SUPPORTED.includes(base) ? base : DEFAULT_LANG;
}

export function detectLang() {
  try {
    const url = new URL(window.location.href);
    const q = url.searchParams.get('lang');
    if (q) return normalizeLang(q);
  } catch {}
  try {
    const saved = localStorage.getItem('lang');
    if (saved) return normalizeLang(saved);
  } catch {}
  try {
    return normalizeLang(navigator.language || navigator.userLanguage);
  } catch {}
  return DEFAULT_LANG;
}

async function fetchJson(url) {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.json();
}

async function loadLocale(lang) {
  if (lang === 'en') {
    dict = EMBEDDED_EN;
    return;
  }
  // dynamic fetch for non-en
  const base = new URL(import.meta.url);
  // public/app/i18n.mjs -> locales/<lang>.json
  const localeUrl = new URL(`./locales/${lang}.json`, base).toString();
  try {
    const remote = await fetchJson(localeUrl);
    // Shallow merge over EN fallback
    dict = deepMerge(EMBEDDED_EN, remote);
  } catch (e) {
    console.warn(`[i18n] Fallback to EN due to: ${e && e.message}`);
    dict = EMBEDDED_EN;
  }
}

function deepMerge(base, override) {
  if (typeof base !== 'object' || base === null) return override;
  const out = Array.isArray(base) ? base.slice() : { ...base };
  for (const [k, v] of Object.entries(override || {})) {
    if (v && typeof v === 'object' && !Array.isArray(v) && typeof base[k] === 'object') {
      out[k] = deepMerge(base[k], v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

export function t(path, params) {
  const val = get(dict, path) ?? get(EMBEDDED_EN, path) ?? path;
  if (!params || typeof val !== 'string') return val;
  return val.replace(/\{(\w+)\}/g, (_, key) => (params[key] ?? `{${key}}`));
}

function get(obj, path) {
  return String(path)
    .split('.')
    .reduce((acc, k) => (acc && acc[k] != null ? acc[k] : undefined), obj);
}

export async function setLang(lang) {
  const next = normalizeLang(lang);
  if (next === currentLang && dict) return;
  await loadLocale(next);
  currentLang = next;
  try {
    document.documentElement.setAttribute('lang', next);
    localStorage.setItem('lang', next);
  } catch {}
  // Minimal visible reflection in v1.6 baseline
  try {
    document.title = t('app.title');
  } catch {}
  try {
    window.dispatchEvent(new CustomEvent('i18n:changed', { detail: { lang: next } }));
  } catch {}
}

export async function initI18n() {
  const lang = detectLang();
  _initPromise = setLang(lang);
  await _initPromise;
}

export function whenI18nReady() {
  return _initPromise || Promise.resolve();
}

// --- Optional helpers for v1.6 step1: apply common static labels ---
export function applyStaticLabels() {
  // Buttons that exist before quiz starts or in header/footer.
  const trySet = (selectorList, text) => {
    for (const sel of selectorList) {
      const el = document.querySelector(sel);
      if (el) {
        if ('value' in el && (el.tagName === 'INPUT' || el.tagName === 'BUTTON')) {
          // For safety, set both value and textContent if applicable
          try { el.value = text; } catch {}
        }
        if ('textContent' in el) el.textContent = text;
        return true;
      }
    }
    return false;
  };
  trySet(['[data-testid="start-btn"]', '#start-btn', 'button#start', 'button[data-action="start"]'], t('ui.start'));
  trySet(['#history-btn', '[data-testid="history-btn"]'], t('ui.history'));
  trySet(['#share-btn', '[data-testid="share-btn"]'], t('ui.share'));

  // --- Step2: common labels that may exist conditionally ---
  trySet(['#restart-btn', '[data-testid="restart-btn"]', 'button[data-action="restart"]'], t('ui.restart'));
  trySet(['#copy-result-btn', '[data-testid="copy-result-btn"]'], t('ui.copyResult'));
  trySet(['#share-result-btn', '[data-testid="share-result-btn"]'], t('ui.shareResult'));
  trySet(['#next-btn', '[data-testid="next-btn"]'], t('ui.next'));
  trySet(['#back-btn', '[data-testid="back-btn"]'], t('ui.back'));
  trySet(['#ok-btn', '[data-testid="ok-btn"]'], t('ui.ok'));
  trySet(['#cancel-btn', '[data-testid="cancel-btn"]'], t('ui.cancel'));

  // Headings
  trySet(['#history-heading'], t('heading.history'));
  trySet(['#result-heading', '#results-heading'], t('heading.result'));
}

