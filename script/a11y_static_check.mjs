// Lightweight a11y static smoke checker (no external deps)
// Checks static attributes that should exist in the HTML at load time.
// Exits non-zero on the first failure.
//
// Usage (CI):
//   node script/a11y_static_check.mjs
// Optional env:
//   E2E_BASE_URL: full URL to test page (takes precedence)
//   APP_URL: base URL to /app/ (we will append test params)

/* eslint-disable no-console */

const DEFAULT_APP_URL = 'https://nantes-rfli.github.io/vgm-quiz/app/';

function pickUrl() {
  const { E2E_BASE_URL, APP_URL } = process.env;
  if (E2E_BASE_URL && E2E_BASE_URL.trim()) return E2E_BASE_URL.trim();
  const base = (APP_URL && APP_URL.trim()) || DEFAULT_APP_URL;
  const u = new URL(base);
  // Ensure we point to app entry with test-friendly params
  if (!u.searchParams.has('test')) u.searchParams.set('test', '1');
  if (!u.searchParams.has('mock')) u.searchParams.set('mock', '1');
  if (!u.searchParams.has('autostart')) u.searchParams.set('autostart', '0');
  return u.toString();
}

async function fetchHtml(url) {
  const res = await fetch(url, {
    redirect: 'follow',
    headers: { 'cache-control': 'no-cache' },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }
  return await res.text();
}

function assertMatch(cond, message, context) {
  if (!cond) {
    console.error(`✗ ${message}`);
    if (context) {
      console.error(context);
    }
    process.exit(1);
  } else {
    console.log(`✓ ${message}`);
  }
}

function checkFeedbackRegion(html) {
  // <div id="feedback" role="status" aria-live="polite" aria-atomic="true">
  const re = /<[^>]*id=["']feedback["'][^>]*>/i;
  const m = html.match(re);
  assertMatch(!!m, '#feedback element exists');
  const tag = m[0];
  assertMatch(/role=["']status["']/i.test(tag), '#feedback has role="status"', tag);
  assertMatch(/aria-live=["']polite["']/i.test(tag), '#feedback has aria-live="polite"', tag);
  assertMatch(/aria-atomic=["']true["']/i.test(tag), '#feedback has aria-atomic="true"', tag);
}

function checkChoicesGroup(html) {
  // <div id="choices" role="group" aria-describedby="prompt">
  const re = /<[^>]*id=["']choices["'][^>]*>/i;
  const m = html.match(re);
  assertMatch(!!m, '#choices element exists');
  const tag = m[0];
  assertMatch(/role=["']group["']/i.test(tag), '#choices has role="group"', tag);
  const mDesc = tag.match(/aria-describedby=["']([^"']+)["']/i);
  assertMatch(!!mDesc, '#choices has aria-describedby', tag);
  const descId = mDesc && mDesc[1];
  assertMatch(descId === 'prompt', '#choices aria-describedby="prompt"', tag);
  // Prompt element exists
  assertMatch(new RegExp(`id=["']${descId}["']`, 'i').test(html), `#${descId} element exists`);
}

function checkHistoryRegion(html) {
  // In app markup the History view is <div id="history-view" role="region" aria-labelledby="history-heading">
  // (Older docs may refer to "#history"; we support both to be tolerant.)
  const m =
    html.match(/<[^>]*id=["']history-view["'][^>]*>/i) ||
    html.match(/<[^>]*id=["']history["'][^>]*>/i);
  assertMatch(!!m, '#history-view (or #history) element exists');
  const tag = m[0];
  const label = /id=["']history-view["']/i.test(tag) ? '#history-view' : '#history';
  assertMatch(/role=["']region["']/i.test(tag), `${label} has role="region"`, tag);
  const mLbl = tag.match(/aria-labelledby=["']([^"']+)["']/i);
  assertMatch(!!mLbl, `${label} has aria-labelledby`, tag);
  const lblId = mLbl && mLbl[1];
  assertMatch(lblId === 'history-heading', `${label} aria-labelledby="history-heading"`, tag);
  assertMatch(new RegExp(`id=["']${lblId}["']`, 'i').test(html), `#${lblId} element exists`);
}

async function main() {
  const url = pickUrl();
  console.log(`[a11y-static] URL: ${url}`);
  const html = await fetchHtml(url);
  checkFeedbackRegion(html);
  checkChoicesGroup(html);
  checkHistoryRegion(html);
  console.log('All static a11y checks passed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

