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

---

## Current workflow set (clean baseline)

- **CI Fast (PR)** — `.github/workflows/ci-fast-pr.yml`  
  Event: `pull_request` (with `paths: ['**']`)  
  Job name: **`ci-fast-pr-build`** (Required)
- **Pages (PR shim)** — `.github/workflows/pages-pr-build.yml`  
  Event: `pull_request`  
  Job name: **`pages-pr-build`** (Required)
- **CI Fast (main)** — `.github/workflows/ci-fast.yml`  
  Event: `push: main`  
  Job name: `ci-fast-main-build`  
  **Runs `clojure -T:build publish` before tests** to render `public/build/dataset.json`.
- **Pages (deploy)** — `.github/workflows/pages.yml`  
  Event: `push: main` (never on PR)
- **daily.json generator (JST)** — `.github/workflows/daily.yml`  
  Creates PR with **PAT** (`DAILY_PR_PAT`) at 00:00 JST.
- **E2E (nightly)** — `.github/workflows/e2e-nightly.yml` (optional)  
  Heavy Playwright suites on a schedule or manual.
- **Lighthouse (nightly)** — `.github/workflows/lighthouse.yml`

### Required status checks

Register **job names** in Rulesets (not display strings):

- `pages-pr-build`
- `ci-fast-pr-build`

### Clojure tests need the dataset

Tests read `public/build/dataset.json`.  
On `main` CI, run before tests:

```bash
clojure -T:build publish
clojure -M:test
```

### Guidelines

- Prefer `pull_request` over `pull_request_target` unless absolutely necessary.
- Give jobs stable, unique `name:` values; if you rename jobs, update Rulesets together.
- Keep PR checks light; shift heavy suites to nightly or `workflow_dispatch`.

