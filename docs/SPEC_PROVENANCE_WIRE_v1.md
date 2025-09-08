
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
  "license_hint": "official|label|unknown|stub"
}
```

- **candidates**: 各行に `provenance` を持つ（`meta.provenance` にもミラー）。
- **daily_auto.by_date[YYYY-MM-DD]**: 候補オブジェクトそのものを格納するため `provenance` が保持される。
- **build/daily_today.json**: `item.meta.provenance` を付与（coerce 時に原データからコピー）。

## 実装ポイント
- `ingest_candidates_v0.mjs` / `harvest_candidates.js`：`ensureProvenance()` で最低限を補完。
- `ensure_min_items_v1_post.mjs`：`buildItem()` で `meta.provenance` を引き継ぐ。
- `export_today_slim.mjs`：`coerce()` で `raw.meta.provenance` もしくは `raw.provenance` を `item.meta.provenance` に反映。



## フォールバック（v1.10）
- 目的: media が無い／手入力 item でも `meta.provenance` を欠かさない。
- 方式: **fallback** として `source=manual|fallback` を付与し、`provider/id` は `media` から推定（無ければ `title|game|composer` 派生）。
- `provider/id` が欠落する場合は **stub** を付与（`provider:'stub'`, `id:'stub:'+sha1hex(title|game|answers)`）
- 実装:
  - コード内: `export_today_slim.mjs`／`ensure_min_items_v1_post.mjs` で **欠落時に動的付与**。
  - 運用: `scripts/provenance_fallbacks_v1.mjs` を **candidates / authoring** 両方のWFに追加。
- KPI: 付与率（candidates）／有無（authoring today）が **100%** であることを Must とする。

## KPI（存在チェック）
- **candidates**: `public/app/daily_candidates.jsonl` に対し、`provenance` の**付与率**を Step Summary に出力。
- **authoring today**: `build/daily_today.json` に対し、`item.meta.provenance` の**有無**を Step Summary に出力。

> 実装: `scripts/kpi/append_summary_provenance.mjs`

