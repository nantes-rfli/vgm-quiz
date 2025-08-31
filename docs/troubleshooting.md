# Troubleshooting

## version.json shows 404 in Network

Cause: SW polling the wrong path under `/app` scope.  
Fix: The app→SW handshake sets the absolute URL; ensure you’re on the latest `sw.js` and reload/Update SW.

## `window.loadVersionPublic` is undefined

Cause: older `app.js`.  
Fix: hard-reload; verify in console `typeof window.loadVersionPublic === "function"`.

## YouTube embed says “動画を再生できません”

Cause: the video ID disallows embeds or has region restrictions.  
Fix: use an alternative ID; use the fallback “別ドメイン” button or “Open in YouTube” link.

## Same-seed but different order?

Verify you are checking after Start, and that `window.__rng` is `"function"`; use `?qp=1` and compare `window.__questionIds`.

---

## PR stuck at “Expected — waiting for status to be reported”

**Likely causes & fixes**

- **PR created with `GITHUB_TOKEN`** (author shows `github-actions[bot]`)  
  → Use a Fine‑grained PAT and set `token: ${{ secrets.DAILY_PR_PAT }}` in `daily.yml`.  
  Verify:
  ```bash
  gh pr view <PR#> -R nantes-rfli/vgm-quiz --json author | jq -r '.author.login'
  ```

- **Required checks mismatch** (registered the UI string like “CI Fast / build (pull_request)” instead of the **job name**)  
  → In Rulesets, require **`pages-pr-build`** and **`ci-fast-pr-build`** (job names).

- **Workflows missing on the PR branch**  
  → Click **Update branch** or push an empty commit to refresh checks:
  ```bash
  git commit --allow-empty -m "chore: refresh checks"
  git push
  ```

- **Two “Pages / build” entries** on PRs  
  → Ensure `pages.yml` does **not** have `pull_request:` (deploy runs only on `push: main`). PR uses the shim `pages-pr-build.yml`.

- **PR CI skipped by path filters**  
  → Ensure `ci-fast-pr.yml` has `paths: ['**']`.

