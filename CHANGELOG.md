# Changelog

## v1.1.0 (2025-08-30)
- Footer: dataset/version display fixed (Dataset vN / 7‑char commit / local time updated)
- E2E: added `test_footer_version.js` and wired into workflow
- Seeded RNG: exported `window.__rng`; `?qp=1` year‑bucket pipeline; debug exports (`__questionIds`, `__questionDebug`)
- Daily mode: `?daily=1|YYYY-MM-DD` (JST); `public/app/daily.json`
- Media preview: YouTube embed with nocookie first + fallback domain; stubbed under `?test=1` / `?lhci=1` / `?nomedia=1`
- Results modal A11y: initial focus, Tab trap, Escape to close; copy toast auto-dismiss
- Version fetch: 8s timeout, in‑flight sharing, 60s TTL; `window.loadVersionPublic/Force`
- Service Worker: app→SW handshake for correct `version.json` URL (no more 404 under /app/ scope)
- Lives rule: `?lives=on` (or number) → end quiz immediately on reaching misses
- Normalize v1.2: leading articles, dash unification, `&→and`, roman numerals I–XX (boundary-safe)

## v1.0.0 (2025-08-27)
- PWA(+IndexedDB)
- Web aliases
- CLJC pipeline
- CLI export
- CI hardening
- Pages (code + app)
