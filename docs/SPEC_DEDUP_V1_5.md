# De-dup v1.5（N-gram 類似 + 正規化）KPI

## 目的
候補集合（daily_candidates.jsonl）における重複・近似重複を **早期検知** する。  
本仕様のKPIは **可視化のみ**（v1.10時点）。実際の削除・統合は v1.11+。

## θ（類似度）の定義
- 文字3-gram の Jaccard 係数。素材は `title | game | composer | answers.canonical` を正規化（NFKC・小文字化・空白圧縮）。
- θ ∈ [0,1]。高いほど類似。

## 出力（GITHUB_STEP_SUMMARY）
- `pairs` 総数（n(n-1)/2）
- しきい値バケット例：`θ ≥ 0.7 / 0.8 / 0.9` の件数
- 上位ペアの抜粋（最大5）

## 運用
`candidates: harvest` の終端で `scripts/kpi/append_summary_dedup_ngram_v1_5.mjs` を実行し、Summary に追記する。

### 任意ゲート（CIを落とす）
- 目的: 明らかな近似重複（θが高い）をPR段階で止める。
- 使い方:
  - Workflow 環境変数 `DEDUP_FAIL_THRESHOLD` に数値（例: `0.85`）を設定。
  - Step `Gate (dedup v1.5, optional)` が実行され、**θ ≥ しきい値**のペアが見つかると失敗。
- 既定値は未設定（= スキップ）。しきい値は運用で決める（推奨初期値 0.85〜0.90）。

## 注意
- 日本語・多言語に対しては NFKC 正規化を採用（辞書は未使用）。将来、分かち書きベースへの切替を検討。
- 本KPIは **アラート** 目的。自動除外は行わない。


## 推奨しきい値（初期運用）
- 初期値は **0.88** を推奨（保守的）。KPIの分布が安定したら 0.85–0.90 の範囲で微調整。
- `DEDUP_FAIL_THRESHOLD` が未設定（空）の場合は **ゲート無効**（Summary だけ出す）。

## Step Summary（例）
```
[dedup v1.5] pairs=12345
[dedup v1.5] θ≥0.7: 12 / θ≥0.8: 5 / θ≥0.9: 1
[dedup v1.5] top pairs:
  - 0.91: "Corridors of Time" vs "時の回廊" (Chrono Trigger)
  - 0.83: "Battle with Magus" vs "Decisive Battle" (Chrono Trigger)
```
> **運用**: θ≥0.9 が継続する場合は seed / aliases を見直す。

## 性能とスケール
- n 件に対し **O(n²)** ペア判定。実運用では **Top-K** 抽出と θ 下限の早期打切りを実装。
- 大規模時は年/シリーズで分割して集計し、Summary に合算を掲載。
