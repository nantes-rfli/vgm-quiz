# Project Status

## Current Step
7b - CLJC core skeleton
7a - Aliases on web

## Next Step
7b - CLJC core prep

## Implemented
- Step 1: Initial CLI prototype
- Step 2: Track dataset loading
- Step 3: Quiz generation and scoring
- Step 4: Web build pipeline
- Step 5: Minimal web quiz playable
- Step 6a: Add stable track IDs
- Step 6b: IndexedDB history
- Step 7b: CLJC core skeleton
- GitHub Actions CI
- CI stabilized (cache 403 fixed)
- Step 7a: Aliases on web

## Open Tasks
- Prepare CLJC core

## How to Run
```bash
clojure -T:build publish
python -m http.server -d public 4444
```
