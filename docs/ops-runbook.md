# Ops Runbook

This document captures day‑to‑day operations for **vgm-quiz**.

## Canonical URLs

- Normal: `/app/`
- Test (no SW registration): `/app/?test=1`
- Mock dataset: `/app/?test=1&mock=1`
- Deterministic: add `&seed=alpha`
- Year-bucket pipeline: add `&qp=1`
- Daily: `&daily=1` (today JST) or `&daily=YYYY-MM-DD`
- Disable media: `&nomedia=1`
- Lighthouse: `/app/?test=1&lhci=1`

## Footer / Version fetch

- Footer: `Dataset: vN • commit: abcdefg • updated: YYYY-MM-DD HH:mm` (local time).
- Fetch policy: **8s timeout**, **in-flight sharing**, **60s TTL**.
- Helpers: `window.loadVersionPublic()` (TTL/in-flight適用), `window.loadVersionForce()` (強制).

## Service Worker handshake

- App posts the absolute `version.json` URL to SW on startup.
- SW polls ~60s using that URL (prevents 404 under `/app/` scope).
- Stop SW (for testing): run in console `navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister()))` then reload.

## Media preview

- YouTube: prefer `youtube-nocookie.com`, fallback to `youtube.com`, plus "Open in YouTube" link.
- Tests and Lighthouse automatically **stub** the player (`?test=1`/`?lhci=1`/`?nomedia=1`).

## Lives rule

- Default: display-only HUD `Misses: x/y`.
- Opt-in: `?lives=on` (or `?lives=5`) → **finish immediately** when misses reach the limit.

## Daily 1 question

- `?daily=1` uses *today (JST)*. `?daily=YYYY-MM-DD` for fixed day.
- Mapping is in `public/app/daily.json`.

## Debugging

- `window.__rng`/`__SEED__` – seeded RNG function & seed.
- `window.__questionIds` / `__questionDebug` – available under `?test=1`.
- `window.versionDebug.stats()/clear()` – inspect/clear version TTL cache.
