# SPEC: Discovery v1（dry-run）

## データモデル（JSONL 1行の例）
```jsonc
{
  "title": "Corridors of Time",
  "game": "Chrono Trigger",
  "album": "Chrono Trigger (Original Soundtrack)",
  "composer": ["Yasunori Mitsuda"],
  "release_date": "1995-03-11",
  "answers": { "canonical": ["Corridors of Time"] },
  "meta": {
    "provenance": {
      "source": "discovery",
      "provider": "apple",
      "id": "itunes:123456789",
      "collected_at": "2025-09-09T09:00:00Z",
      "hash": "sha1hex(nfkc-lower of title|game|album|composer)",
      "license_hint": "preview"
    }
  },
  "dedup": { "theta": 0.12 },
  "confidence": 0.73,
  "notes": "normalized from iTunes Search"
}
```

## 正規化規則（要点）
- 文字種: **NFKC + lower**、記号/全角半角/長音を正規化
- `composer` は配列化、`answers.canonical` は1要素以上を確保
- `id` は `provider` の名前空間を付し、**一意**にする（例: `itunes:{trackId}`）
- `hash` は `title|game|album|composer` を `NFKC+lower` 後に `sha1hex`

## スコア
- `confidence`（0–1）: 公式性/一致度/メタ完備度の合成
- `dedup.theta`（0–1）: 既存データとの近似度（**advice**用途）

## KPI（このIssue）
- `official_rate`, `hit_rate`, `duplicate_ratio`, `fail_reasons_top3` を Step Summary へ出力設計
- Collector 全体 KPI の統合は `v111-kpi-collector` で実施
