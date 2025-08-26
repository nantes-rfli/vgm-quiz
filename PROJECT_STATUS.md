# Project Status

## Current Step
5 - Minimal web quiz playable

## Next Step
- 6a - Add stable track IDs
- 6b - IndexedDB history

## Implemented
- Step 1: Initial CLI prototype
- Step 2: Track dataset loading
- Step 3: Quiz generation and scoring
- Step 4: Web build pipeline
- Step 5: Minimal web quiz playable
- GitHub Actions CI
- CI stabilized (cache 403 fixed)

## Open Tasks
- Add stable track IDs
- Implement IndexedDB history

## How to Run
```bash
clojure -T:build publish
python -m http.server -d public 4444
```
