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

## 補足：`public/app/daily_auto.json` との関係
- 現行アプリ（UI-slim v1.12）は `?daily_auto=1` で互換マップを参照する。  
- v1.13 では publish 時に **当日分を互換マップへ自動追記**し、ユーザー導線を確保。  
- 将来は本フォーマットを**直接読込**へ移行予定（互換マップは段階的廃止）。
