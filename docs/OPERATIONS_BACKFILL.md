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
