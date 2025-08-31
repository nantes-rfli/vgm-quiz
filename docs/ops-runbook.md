# Ops Runbook

## Manual deploy (Pages)

Open **Actions → Pages → Run workflow** (branch: `main`) to redeploy `public/`.

## Daily PR at 00:00 JST

Check **Actions → daily.json generator (JST)**. The PR should include:

- `public/app/daily.json`
- `public/daily/*.html`
- `public/daily/feed.xml`

Author must be **you** (PAT owner), not `github-actions[bot]`. If bot appears:

- Update `DAILY_PR_PAT` secret (create a fresh PAT; repo scope)
- Re-run the workflow.

## Empty deploy (to test SW update)

```bash
git switch main && git pull --ff-only
git commit --allow-empty -m "chore(pages): redeploy"
git push origin main
```

## Health checks (5-min)

- `/daily/index.html` → **200**
- `/daily/latest.html` → **200** and redirects to `/app/?daily=YYYY-MM-DD`
- `/daily/feed.xml` → **200**
- Footer (commit / updated) reflects latest deploy

## E2E (matrix)

Suites: `smoke`, `a11y`, `footer`, `share`, **`normalize`**, **`lives`**

## Lighthouse

Nightly run (desktop). Budgets & asserts enabled.

- View the job **Summary** for the temporary-public report URL.
- Artifact **lighthouse-report/report.html** is saved for 7 days.
