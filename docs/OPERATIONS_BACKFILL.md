# Backfill 運用（大量追加の指針）

## 目的
数千～数万件規模の過去出題を**安全に**追加し、日次運用と両立させる。

## by_year I/F（擬似例）
```jsonc
// public/app/by_year/1995.json
{
  "year": 1995,
  "items": [
    { "date": "1995-04-27", "id": "apple:1550828100", "title": "Corridors of Time", "game": "Chrono Trigger" },
    { "date": "1995-08-11", "id": "apple:1550828200", "title": "Battle with Magus",  "game": "Chrono Trigger" }
  ]
}
```

### 集約ビュー
- `public/app/daily_auto.json` は by_year を集約した**読み取りビュー**にする（生成時に結合）。
- 先取りは**最大90日**（未来地平線）。超過分は Pool に留め、段階投入。

### PR 粒度
- 1PR = 30–90日分を目安。レビュー容易性とCI時間を確保。

## 原則
- **年別分割**: by_date を年ごとに分割（`public/app/by_year/YYYY.json`）。`daily_auto.json` から参照できる集約ビューを用意。
- **未来地平線**: 先取りは最大90日。超過分は **Pool** に留め、段階的に反映。
- **PR 粒度**: 30–90日/PR を目安に分割。レビュー容易性とCI時間を担保。

## モード
- **forward（先取り）**: 未来の日付に一括で積む。日次cronは既存日をスキップするため、運用が安定。
- **backfill（埋め戻し）**: 過去の空白を埋める。アーカイブを早く厚くしたい時に有効。

## 手順（例）
1. ingest → guard → dedup → score を実行し、Pool を作る
2. bulk pick（backfill）で過去 N×30日分を段階投入（1PR=30–90日）
3. 以後は日次 cron（forward）と週次 Discovery で在庫補充

## 障害時対応
- 停止スイッチ（Repo Variables）で自動採用を一時停止
- ロールバック: 日付範囲ごとに revert 手順を用意（年別分割があるとやりやすい）

## KPI
- 1PRあたり追加件数、追加後のエラー率、dedup率の推移、ユーザ正答率帯の変化


## by_year スキーマ（JSON Schema, 抜粋）
```jsonc
{
  "type": "object",
  "required": ["year", "items"],
  "properties": {
    "year": { "type": "integer", "minimum": 1970, "maximum": 2100 },
    "items": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["date", "id", "title", "game"],
        "properties": {
          "date": { "type": "string", "pattern": "^\\d{4}-\\d{2}-\\d{2}$" },
          "id": { "type": "string", "minLength": 3 },
          "title": { "type": "string", "minLength": 1 },
          "game": { "type": "string", "minLength": 1 }
        },
        "additionalProperties": true
      },
      "minItems": 1
    }
  },
  "additionalProperties": false
}
```

## 失敗時のフォールバック
- **日重複**: 既存 `by_date/YYYY-MM-DD.json` がある日は**スキップ**（重複挿入しない）。
- **無効ID**: `provider:id` 形式でない場合は `provider=stub` として採用可（`POLICY_PROVENANCE.md` 準拠）。
- **不可視メディア**: 再生不可が想定される場合は `license_hint=stub` に落としつつ採用（長期は上流改善）。

## KPI（backfill）
- 追加件数、スキップ件数（既存/重複/検証NG）、`provider=stub` の割合、適用後のE2E/Schemaエラー率。

## 検証・ドライラン
- `scripts/backfill/verify_by_year.mjs --file public/app/by_year/1995.json --dry-run`  
  - 検証のみ（JSON Schema / 既存日衝突 / id 形式 / media 可視性ヒント）
- 成功後に `--apply` で `by_date/` を生成し PR 作成。PR 粒度は **30–90日** を推奨。
