# Data Pipeline Overview

This document covers dataset generation and daily scheduling.

## Build

Run:

```bash
clojure -T:build publish
```

Generates `public/build/dataset.json` and related artifacts; tests assume these are present.

## Daily generation

`scripts/generate_daily.js` (JST-based, FNV1a; avoids duplicates in last 30 days) writes:

```json
{
  "YYYY-MM-DD": { "title": "...", "type": "title→game | game→composer | title→composer" },
  "...": "..."
}
```

`scripts/generate_daily_index.js` outputs:

- `public/daily/index.html` (descending list)
- `public/daily/latest.html` (redirect to `/app/?daily=YYYY-MM-DD`)

`scripts/generate_daily_feed.js` outputs:

- `public/daily/feed.xml` (RSS 2.0, JST midnight as pubDate, newest 60 entries)

`daily.yml` (00:00 JST) creates a PR including:

- `public/app/daily.json`
- `public/daily/*.html`
- `public/daily/feed.xml`

Pages deploy (`pages.yml`) also regenerates index/feed as a safety net.

## Sharing / OGP

`scripts/generate_share_page.js` and `scripts/generate_ogp.js` produce per-day static share HTML and OGP images.
Subtitle selection:

1. Prefer `public/app/daily.json[date].type` → `"Title → Game" / "Game → Composer" / "Title → Composer"`
2. Fallback to env `OGP_SUBTITLE` (for backward compatibility)

## Service Worker

Version handshake via `version.json`. SW polls roughly every 60 seconds for updates.

- `public/app/sw_update.js` listens to registration (`updatefound`/`waiting`) and shows an accessible banner.
- Clicking “更新” sends `{type: 'SKIP_WAITING'}` to SW; on `controllerchange` the page reloads.
- SW handles `message: SKIP_WAITING` and calls `clients.claim()` on `activate`.
- Legacy in-app banner in `app.js` is **deprecated** and no-op.
