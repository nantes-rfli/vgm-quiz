# Provenance ポリシー（由来・追跡可能性）

## 目的
自動収集・自動作問の規模が大きくなる前に、**再現性/追跡/削除**に耐えるメタデータ設計を定める。

## 候補に付与する項目
```json
provenance: {
  "source": "itunes-lookup|yt-search|apple-music-api|manual|other",
  "provider": "apple|youtube|...",
  "id": "external id",
  "collected_at": "ISO-8601 UTC",
  "hash": "sha1:... (payloadの安定ハッシュ)",
  "license_hint": "apple_embed|youtube_embed|ugc_youtube|official_site|label|unknown|stub"
}
```

## 方針
- **必須**: `source/collected_at/hash`。`license_hint` は best-effort だが記録する。
- **不変性**: provenance は**後から書き換えない**（上書きではなく追記/補足）。
- **追跡**: 削除要請等に備え、by_date から逆引きできるよう `hash` をキーに紐付ける。

## 運用
- ingest/guard/score/pick の各ステップで provenance の**継承**を保証。
- PR のテンプレートに provenance の要約が出るよう Step Summary を整備。

## 例外
- 手動seed（`source=manual`）は `collected_at` の記録だけでも許容する。

## Stub 既定（v1.10）
- `provider/id` が取得不能なケースでは **stub 既定**を採用する。
  - `provider`: "stub"
  - `id`: "stub:" + <sha1hex(title|game|answers.canonical)> （正規化後の連結文字列を SHA-1）
  - `license_hint`: "stub"
- 既存の `provider/id` がある場合は**上書きしない**（idempotent）。
- ただし `provider='stub'` かつ `id` が `"stub"` のみ、または `"stub:"` プレフィックスが無い場合は**正規化して再付与**（`"stub:<sha1hex(...)")`）。

## 参考
- `docs/SPEC_DEDUP_v1.md`, `docs/SPEC_NOTABILITY.md`, `docs/QUALITY_KPIS.md`
