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

## Daily 1-question (automation)

- Source of truth: `public/app/daily.json`
  ```json
  { "version": 1, "tz": "Asia/Tokyo", "map": { "YYYY-MM-DD": { "title": "..." } } }
  ```
- Update policy: **nightly (00:00 JST)** via GitHub Actions → `.github/workflows/daily.yml`  
  The generator selects 1 title deterministically from the current dataset based on the date (JST).
- Manual run (local):
  ```bash
  node scripts/generate_daily.js               # for today (JST)
  DAILY_DATE=2025-09-01 node scripts/generate_daily.js
  DATASET_URL=https://nantes-rfli.github.io/vgm-quiz/build/dataset.json node scripts/generate_daily.js
  ```
- Notes: selection avoids repeating the same title within the last **30 days** (configurable via `AVOID_DAYS`).

## Debugging

- `window.__rng`/`__SEED__` – seeded RNG function & seed.
- `window.__questionIds` / `__questionDebug` – available under `?test=1`.
- `window.versionDebug.stats()/clear()` – inspect/clear version TTL cache.

---

## PR checks & branch protection (definitive rules)

- **Required status checks are evaluated against *job names***, not the UI display string.
  - Register these two **job names** in Rulesets → *Status checks that are required*:
    - `pages-pr-build`
    - `ci-fast-pr-build`
- `pages.yml` (deploy) **must not** run on PRs. Keep it scoped to `push: main` only.
- `ci-fast.yml` runs on `push: main`; `ci-fast-pr.yml` runs on `pull_request`.

### 5‑minute verification (after any CI change or PAT rotation)

**GUI**
1. Actions → **daily.json generator (JST)** → *Run workflow* (branch: `main`).
2. A PR from `bot/daily` opens. Confirm **Author = your account** (PAT owner), not `github-actions[bot]`.
3. In **Checks**, ensure only:
   - **Pages / pages-pr-build**
   - **CI Fast / ci-fast-pr-build**
   appear and are green → PR auto‑merges → Pages deploy runs.

**CLI**
```bash
gh pr list -R nantes-rfli/vgm-quiz --search "head:bot/daily" -L 1 --json number,author,url
gh pr checks <PR#> -R nantes-rfli/vgm-quiz
```

### Daily PR author (PAT)

- `daily.yml` must create PRs with: `token: ${{ secrets.DAILY_PR_PAT }}` (Fine‑grained; repo‑scoped; **Contents: RW**, **Pull requests: RW**).
- Verify author:
```bash
gh pr view <PR#> -R nantes-rfli/vgm-quiz --json author | jq -r '.author.login'
# => should be your username (not github-actions[bot])
```

