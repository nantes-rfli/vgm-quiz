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
  "license_hint": "official|label|unknown"
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

## 参考
- `docs/SPEC_DEDUP_v1.md`, `docs/SPEC_NOTABILITY.md`, `docs/QUALITY_KPIS.md`
