# BACKFILL_ALIASES (v1)

`public/app/daily_auto.json` の `by_date` を走査して、`data/aliases/{game,composer,track}.json` に
不足している正規化キー（小文字化＋空白圧縮）→ 正式表記を追加します。

- 既存値は上書きしません（衝突はスキップ）
- ログ: `build/logs/backfill_YYYYMMDD.txt`
- **注意:** 自動で意味解釈はしません。名称統一は軽微な補完（lower/space）までです。
