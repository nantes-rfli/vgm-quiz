# SPEC: by_year ビュー v1

## 目的
年次の参照性と大規模 backfill の安全性を両立する読み取りビュー。

## ファイル配置
- `public/app/by_year/{YYYY}.json`

## スキーマ（最小）
```jsonc
{
  "year": 2001,
  "items": [
    {
      "date": "2001-07-19",
      "id": "apple:1234567890",
      "title": "To Zanarkand",
      "game": "FINAL FANTASY X"
    }
  ],
  "kpi": { "count": 1, "unknown_ratio": 0.0 }
}
```

## ID の決定
- 優先: `meta.provenance.provider:id`
- 不在時: `provider:"stub", id:"stub:"+sha1hex(title|game|answers.canonical)`

## 年の決定
- 原則 `date` の年を採用。
- 判定不可の場合は `year: null` として `unknown` バケットへ格納。

## フォールバック
1. `title`/`game` 欠落時は `answers.canonical[0]` で補完
2. `meta.provenance` 欠落時は export 後の fallback を必ず適用
3. 同一入力に対して生成結果が変わらない（冪等）こと

## KPI
- `count`（年内件数）
- `unknown_ratio`（`year:null` の割合）
- 生成時の Step Summary では年別件数上位と `unknown_ratio` を出力

## 運用
- backfill: 過去の空白を段階投入（1PR=30–90日）
- forward: 未来日への先取り投入も同I/Fで可能
- 失敗時は `--dry-run` で差分を確認し、`--write` 時のみ出力を更新

