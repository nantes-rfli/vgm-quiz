
# SPEC_PROVENANCE_WIRE v1（v1.10）

**目的**: 候補（candidates）→ pick（daily_auto）→ authoring（build/daily_today.json）まで、
`provenance`（由来メタ）を**欠落させずに伝搬**させる。

## 形（最小）
```jsonc
provenance: {
  "source": "seed|dataset|yt-search|itunes-lookup|manual|other",
  "provider": "apple|youtube|...",
  "id": "external id or url",
  "collected_at": "ISO-8601 UTC",
  "hash": "sha1:<stable-hash>",
  "license_hint": "official|label|unknown"
}
```

- **candidates**: 各行に `provenance` を持つ（`meta.provenance` にもミラー）。
- **daily_auto.by_date[YYYY-MM-DD]**: 候補オブジェクトそのものを格納するため `provenance` が保持される。
- **build/daily_today.json**: `item.meta.provenance` を付与（coerce 時に原データからコピー）。

## 実装ポイント
- `ingest_candidates_v0.mjs` / `harvest_candidates.js`：`ensureProvenance()` で最低限を補完。
- `ensure_min_items_v1_post.mjs`：`buildItem()` で `meta.provenance` を引き継ぐ。
- `export_today_slim.mjs`：`coerce()` で `raw.meta.provenance` もしくは `raw.provenance` を `item.meta.provenance` に反映。

## KPI（存在チェック）
- **candidates**: `public/app/daily_candidates.jsonl` に対し、`provenance` の**付与率**を Step Summary に出力。
- **authoring today**: `build/daily_today.json` に対し、`item.meta.provenance` の**有無**を Step Summary に出力。

> 実装: `scripts/kpi/append_summary_provenance.mjs`

