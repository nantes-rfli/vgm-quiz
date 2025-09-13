# DAILY_ONEQ_FORMAT（プレビュー）

## 目的
v1.13 の “1問/日” で生成する JSON の最小フォーマット（**プレビュー段階**）。

## フォーマット（暫定）
```json
{
  "date": "YYYY-MM-DD",
  "question": {
    "type": "guess-track",
    "locale": "ja",
    "title": "…",
    "game": "…",
    "composer": "…",
    "track/id": "…"
  },
  "media": {
    "provider": "apple|youtube",
    "id": "…"
  },
  "provenance": {
    "source": "docs/data/media_map.json",
    "provider": "apple|youtube",
    "id": "…",
    "collected_at": "ISO-8601",
    "hash": "sha256(track/id::provider::id)",
    "license_hint": "embed-only; see provider terms"
  }
}
```

## 注意
- 本ファイルは **プレビュー用途**。公開パス・キー名は後続の実装で固定化する。
- `provenance` は 6 項目を満たす（source/provider/id/collected_at/hash/license_hint）。
- 生成に使用するメディアIDは `docs/data/media_map.json` を**唯一の正**として参照する。
