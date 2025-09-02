# GitHub Admin Guide

This guide gathers all repository admin tasks (PAT, Rulesets, Pages) in one place.

## Required checks (Rulesets)

PRs are required to pass these **job names**:

- `pages-pr-build`
- `ci-fast-pr-build`
- `required-check`  （workflow: *e2e (light required)* の job 名）

If you rename jobs or workflows, update Rulesets so PRs don’t get stuck in “waiting…”.  
(Settings → Rules → Rulesets → Edit → **Require workflows**)

## Secrets

- `DAILY_PR_PAT`
  - Personal Access Token (classic), **repo** scope is enough. Used by `daily.yml` to author PRs as you.
  - Renew before it expires; if it expires the PR author becomes `github-actions[bot]` and the daily PR may fail.

- `CPR_PAT` – Fine-grained Personal Access Token used by **tools-apple-enrich** to create PRs (so that **Required checks trigger**).
  - **Repository access**: Only this repo
  - **Permissions** (minimum):
    - Contents: **Read and write**
    - Pull requests: **Read and write**
    - Issues: **Read and write**（ラベル付与をする場合）
  - Classic PAT を使う場合は `repo` スコープで代替可

## Pages

- Deployed from `public/` via `pages.yml` (push to `main` or manual **Run workflow**).
- Safety steps re-generate **`/daily/index.html`** and **`/daily/feed.xml`** just before deploy.

**Manual redeploy** (useful for SW update tests):

```bash
git switch main && git pull --ff-only
git commit --allow-empty -m "chore(pages): redeploy"
git push origin main
```

## Nightly jobs

- `daily.yml` – 00:00 JST: creates daily PR (includes `public/app/daily.json`, `/daily/*.html`, `/daily/feed.xml`)
- `lighthouse.yml` – around 03:10 JST: budgets/asserts, report URL to Summary, HTML artifact saved for 7 days
- `e2e-matrix.yml` – 04:40 JST: smoke/a11y/footer/share/normalize/lives suites

## Verifications

- `/daily/index.html` and `/daily/latest.html` return 200; latest redirects to `/app/?daily=YYYY-MM-DD`
- `/daily/feed.xml` returns 200
- App footer shows latest `commit` and `updated` after deploy
