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

## 注意
- 日本語・多言語に対しては NFKC 正規化を採用（辞書は未使用）。将来、分かち書きベースへの切替を検討。
- 本KPIは **アラート** 目的。自動除外は行わない。
