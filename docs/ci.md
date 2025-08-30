# CI & E2E Overview

## Workflows

- `ci.yml` / `ci-fast.yml` – Clojure + JS basics
- `e2e.yml` – Playwright E2E suite
- `pages.yml` – Deploy to GitHub Pages on `main`
- `release.yml` – Release flow
- `lighthouse.yml` – Nightly Lighthouse CI against production (`?test=1&lhci=1`)

## E2E Suite

```
node e2e/test.js
node e2e/test_free_aria.js
node e2e/test_footer_version.js
node e2e/test_results_share.mjs
node e2e/test_lives_visual.mjs
node e2e/test_pipeline_flag.mjs
node e2e/test_media_button.mjs
node e2e/test_results_modal_a11y.mjs
node e2e/test_lives_rule_end.mjs
node e2e/test_normalize_cases.mjs
```
