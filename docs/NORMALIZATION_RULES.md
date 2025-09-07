# NORMALIZATION_RULES (v1.8 Phase 2)

> **Note:** `normalize_core.mjs` は「単一アイテム容器」向けです。`by_date` マップを含む `daily_auto.json` に対して実行した場合は、**破壊しない（パススルー）**動作になります。

- 入力の揺れ（`{ date,item }` / `{ date,...item }` / `{ date,items:[...] }` / 深い入れ子）を 1系統に正規化。
- `answers.canonical` は string / string[] 両対応（内部判定は正規化後の同値比較）。
- `item.norm.*` に小文字化＋空白圧縮を格納。

