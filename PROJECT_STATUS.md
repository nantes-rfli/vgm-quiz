# Project Status: vgm-quiz

## Current
- GitHub Pages deploy is green; visible at `https://nantes-rfli.github.io/vgm-quiz/app/`.
- E2E flakes were addressed: TEST_MODE (no SW), deterministic seed, mock dataset, trace logs, CI split (CI Fast + Pages).

## UI–E2E contract (fixed)
- `#mode` options are **exactly**:
  - `multiple-choice`
  - `free`
- `#start` button exists and is visible to start the game.

## Verification URLs
- **Normal**:  
  `https://nantes-rfli.github.io/vgm-quiz/app/`
- **Test mode (no Service Worker)**:  
  `https://nantes-rfli.github.io/vgm-quiz/app/?test=1`
- **Deterministic (seed)**:  
  `https://nantes-rfli.github.io/vgm-quiz/app/?test=1&seed=demo`
- **Mock dataset (fast E2E)**:  
  `https://nantes-rfli.github.io/vgm-quiz/app/?test=1&mock=1&seed=demo`

## Pages deploy verification
1. Confirm **Pages** workflow ran automatically on push to `main` (or via `workflow_run` from **CI Fast**).  
2. Check `build.json` responses (should show latest `short_sha`):  
   - `/build.json?ts=NOW`  
   - `/app/build.json?ts=NOW`  
3. Footer should show: `Dataset vX • <content_hash> • <generated_at> • commit: <short_sha>`

## E2E artifacts (for failures)
- Artifacts directory: `artifacts/`
  - `trace.zip` — Open with `npx playwright show-trace artifacts/trace.zip`
  - `console.log` — Console messages, page errors
  - `network.log` — Failed/Non-OK requests
  - `*.html` / `*.png` — DOM snapshot and screenshot at failure

## CI/Workflows quick reference
- **CI Fast** (PR + main): unit tests + static guards + HTML smoke, builds `public/` beforehand.
- **Pages** (main + CI Fast success fallback): publish + deploy to GitHub Pages.
- **e2e (on-demand)**: manual/nightly Playwright E2E (uses `?test=1&mock=1&seed=e2e`).

## Developer shortcuts
- Build site locally: `clojure -T:build publish`
- HTML smoke: `npm run smoke`
- Run E2E locally (ex.):  
  `APP_URL="http://127.0.0.1:8080/app/" node e2e/test.js`
