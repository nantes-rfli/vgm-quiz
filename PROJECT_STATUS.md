# Project Status

## Current Step

## Next Step

## Implemented
- Step 1: Initial CLI prototype
- Step 2: Track dataset loading
- Step 3: Quiz generation and scoring
- Step 4: Web build pipeline
- Step 5: Minimal web quiz playable
- Step 6a: Add stable track IDs
- Step 6b: IndexedDB history
- Step 7a: Aliases on web
- Step 7b: CLJC core skeleton
- Step 7c: CLJC question pipeline
- GitHub Actions CI
- CI stabilized (cache 403 fixed)
- QA-1

## Open Tasks

## How to Run
```bash
clojure -T:build publish
python -m http.server -d public 4444
```

## Activity Log
- CI: lint + schema test
- CI: clj-kondo via release binary
- CI: clj-kondo via setup-clojure
- 2025-08-26: Fix dataset normalization (:id → :track/id); add guard test
- Enable public code snapshot via GitHub Pages
- 12: export for みんはや
- 11: web pipeline applied
- Pages: publish app under /app
- Release workflow added
- 2025-08-27: PWA update toast

