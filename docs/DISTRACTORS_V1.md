# Distractors v1（誤答生成の最小ルール）

v1.7 の **4択肢** を安定供給するための最小実装。`daily_auto.json` 生成後に **当日分だけ** post-process して、`items[*].choices` を補完/強化する。

## 目的
- 候補が少ない日でも **4択を埋める**（正解＋誤答3）
- **似すぎ/遠すぎ**を避けるためのシンプルなスコアリング
- 既存生成物に干渉しない（不足時のみ補う／`--force` で再生成）

## 生成ルール（MVP）
- 正解: `answers.canonical`
- 候補プール: `daily_auto.by_date[*].items[*].answers.canonical`（全期間横断）
- スコア:
  - +2: 同作曲者（`track.composer` 一致）
  - +1: 同シリーズ/同ゲーム（`game.series` or `game.name` 部分一致）
  - +0.5: 年が近い（`|year - year'| <= 2`）
- 3件に満たなければランダム補完（重複/正解除外）

## 使い方
```bash
node scripts/distractors_v1_post.mjs \
  --in public/app/daily_auto.json \
  --date $(TZ=Asia/Tokyo date +%F)
```

オプション:
- `--out`: 別ファイルへ書き出す（省略時は上書き）
- `--force`: 既に choices があっても再生成

## パイプラインへの挿入位置（例）
```bash
# 生成までは従来どおり
node scripts/generate_daily_from_candidates.js \
  --in public/app/daily_candidates_scored_enriched_start.jsonl \
  --date $(TZ=Asia/Tokyo date +%F)

# 生成後に当日分だけ choices を補完
node scripts/distractors_v1_post.mjs \
  --in public/app/daily_auto.json \
  --date $(TZ=Asia/Tokyo date +%F)

# その後にバリデーション
node scripts/validate_authoring.js
```

## 品質と制約
- `choices` は **正解を必ず含む4件**（ユニーク）
- 既存 `choices` が十分（4件かつ正解含む）なら触らない（`--force` を除く）
- 似すぎの抑制は簡易（v1）。将来は多様性ペナルティや重複防止を強化

## 将来拡張（v2+）
- 問いの種類別（曲名当て/ゲーム当て/作曲者当て）で候補集合と類似度指標を切替
- 別名・表記揺れ（ローマ数字/長音/CJK空白）に基づく **近似誤答** の統制
- 候補の豊富化（許可リスト拡張・seed拡充・近似/関連度の学習化）
