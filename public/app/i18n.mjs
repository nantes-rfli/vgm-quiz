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
}

export async function initI18n() {
  const lang = detectLang();
  await setLang(lang);
}

