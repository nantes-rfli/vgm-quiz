# Troubleshooting

## Pages deploy doesn’t reflect changes

- Ensure `pages.yml` uploads **`public/`** (with `.nojekyll`)
- Check **Deployments → github-pages** and verify the deployed commit matches `main` HEAD
- Run **Actions → Pages → Run workflow** (branch: `main`) to force redeploy

## /daily/index.html or /daily/latest.html returns 404

- Ensure `scripts/generate_daily_index.js` runs in `daily.yml` and **`pages.yml`** (pre-deploy safety)
- In `daily.yml`, include `public/daily/*.html` in `create-pull-request` `add-paths`
- After merging the PR, re-run **Pages** deploy (or push an empty commit)

## /daily/feed.xml returns 404

- Confirm `scripts/generate_daily_feed.js` is invoked by `daily.yml` **and** by `pages.yml` (pre-deploy safety)
- In the daily PR, verify `public/daily/feed.xml` is included
- After merging, run **Pages** to publish the file

## SW update banner doesn’t show up

- Ensure `public/app/sw_update.js` is included **after** SW registration script in `index.html`
- Open DevTools → Application → Service Workers; confirm **Waiting** state appears on update
- As a quick test, do an empty commit to trigger deploy (see Ops Runbook), keep the old tab open, and watch for the banner

## Required checks keep “waiting…” on PR

- Rulesets require **job names** `pages-pr-build` / `ci-fast-pr-build`
- If you renamed jobs or workflows, update Rulesets accordingly

## Daily PR authored by github-actions[bot]

- `DAILY_PR_PAT` is missing/expired. Create a new PAT and update repo secrets.
