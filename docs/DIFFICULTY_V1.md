# Difficulty v1（暫定スコアリング 0..1）

`daily_auto.json` 生成後、**当日分**の `items[*].difficulty` を補完する最小ルール。既存値は尊重（`--force` のみ上書き）。

## 目的
- 自動生成された問題の**難易度を大まかに定量化**し、日次バンドルの品質監視や将来の出題調整に活かす

## ルール（MVP）
- 基本値 `0.6` から、**周知度の proxy で減点（易化）**、**時代で加点（難化）**
  - 作曲者出現頻度 `>=4` : `-0.12`
  - シリーズ/ゲーム出現頻度 `>=4` : `-0.10`
  - Opening/Main Theme/序曲 など: `-0.08`
  - エイリアス `>=3` : `-0.07`
  - 年 `<1995`: `+0.08` / 年 `>2015`: `+0.04`
- 最後に `0..1` に clamp

## CLI
```bash
node scripts/difficulty_v1_post.mjs \
  --in public/app/daily_auto.json \
  --date $(TZ=Asia/Tokyo date +%F)
```

オプション:
- `--out`: 別ファイルに書き出す（省略時は上書き）
- `--force`: 既存 difficulty があっても再計算

## パイプライン挿入位置（例）
```bash
node scripts/generate_daily_from_candidates.js \
  --in public/app/daily_candidates_scored_enriched_start.jsonl \
  --date $(TZ=Asia/Tokyo date +%F)

node scripts/distractors_v1_post.mjs \
  --in public/app/daily_auto.json \
  --date $(TZ=Asia/Tokyo date +%F)

node scripts/difficulty_v1_post.mjs \
  --in public/app/daily_auto.json \
  --date $(TZ=Asia/Tokyo date +%F)

node scripts/validate_authoring.js
```

## 将来拡張（v2+）
- 問題タイプ別の特徴量（作曲者当て/曲名当て 等）
- 実プレイログ（正答率/平均時間）からの学習
- メタの信頼度/ソース数なども加味
