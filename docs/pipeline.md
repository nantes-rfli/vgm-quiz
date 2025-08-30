# Data Pipeline Overview

This document describes the **data contracts** and artifacts produced for the app.
It focuses on *what the app expects* rather than the internal implementation details.

## Build artifacts (consumed by the app)

- `public/build/dataset.json` — quiz tracks and metadata
- `public/build/aliases.json` — normalization aliases (merged with `public/app/aliases_local.json` if present)
- `public/build/version.json` — deployment metadata used by the footer & SW

### `version.json` (contract)

```json
{
  "dataset": "v1",
  "commit": "abcdef1",
  "content_hash": "sha256:...",
  "generated_at": "2025-08-30T06:39:00Z"
}
```

**App behavior**

- Footer shows `Dataset: v1 • commit: abcdef1 • updated: YYYY-MM-DD HH:mm` (local time)
- The app uses 8s timeout, in-flight sharing, and 60s TTL when fetching `version.json`
- The app exposes `window.loadVersionPublic()` (TTL/in-flight適用) and `window.loadVersionForce()` (強制)

### Aliases

- App loads `../build/aliases.json`
- If present, `./aliases_local.json` is merged **on top** (local overrides → easy small PRs)

### Mock dataset

- For development and CI, `?mock=1` routes the app to `public/app/mock/dataset.json`
- Media previews are stubbed under `?test=1` / `?lhci=1` / `?nomedia=1`

## Deterministic ordering (RNG & pipeline)

- `?seed=...` → deterministic RNG (`window.__rng` is exposed under `?test=1`)
- `?qp=1` → year-bucket pipeline for better spread

## Daily mapping

- `public/app/daily.json` maps dates to a single track (by `id` or `title`)
- `?daily=1` uses **today (JST)**; `?daily=YYYY-MM-DD` uses a fixed date

