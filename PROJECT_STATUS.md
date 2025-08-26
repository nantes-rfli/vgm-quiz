# Project Status

## Current Step
6b - IndexedDB history

## Next Step
7a - Aliases on web

## Implemented
- Step 1: Initial CLI prototype
- Step 2: Track dataset loading
- Step 3: Quiz generation and scoring
- Step 4: Web build pipeline
- Step 5: Minimal web quiz playable
- Step 6a: Add stable track IDs
- Step 6b: IndexedDB history
- GitHub Actions CI
- CI stabilized (cache 403 fixed)
- QA-1

## Open Tasks
- Implement aliases on web

## How to Run
```bash
clojure -T:build publish
python -m http.server -d public 4444
```
