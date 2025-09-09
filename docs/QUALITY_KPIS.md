# Quality KPI（品質指標とSLO）

## 目的
自動化の拡張に伴う品質劣化を**早期に検知**し、運用で矯正可能にする。

## 最小必須セット（Step Summary への出力）
- **guard**: `in/kept/drop`、`warn` 件数、主な理由トップ3
- **dedup**: `pairs` / `θ≥0.7/0.8/0.9` / `top pairs (≤5)`、`DEDUP_FAIL_THRESHOLD`（設定時のみ表示）
- **score/notability**: `mean/median`、帯域比（High/Med/Low）
- **pick**: 採用件数 / スキップ理由（重複/枯渇/既存日）

> これらは**全ワークフロー**で共通出力とし、欠落時は赤信号（要修正）。

## 日次KPI（Step Summary に出力）
- guard: `in/kept/drop`, reasons（`youtube-id-format`, `suspicious-title` など）
- dedup: `examined/dup-exact/dup-similar`
- score: `mean/median` 難易度、帯域比率
- pick: 採用/スキップの理由（重複/枯渇/既存日）

## 週次KPI
- 直近7/30日の正答率分布（目標帯 60–85%）
- Notability 帯域の実績（High/Med/Low）
- 収集→採用の**転換率**（Discovery→Harvest→Gate→採用）

## SLO（例）
- pipeline 失敗率 < 1%/週
- guard 警告率 < 30%（移動平均）
- dedup 率 過去4週で漸減（≒重複が減っている）

## 運用
- 赤信号の閾値を越えたら自動採用を停止（Repo Variables）
- 重要KPIは README バッジ化 or 週次PRのSummaryに集約


## provenance（存在チェック, v1.10）
- candidates: `public/app/daily_candidates.jsonl` の `provenance` 付与率（provider/id/collected_at）
- authoring today: `build/daily_today.json` の `item.meta.provenance` 有無
> 実装: `scripts/kpi/append_summary_provenance.mjs`

### by_year（読み取りビュー）
- 年別 `count`、`unknown_ratio` を Step Summary に出力
- しきい値サンプル: `UNKNOWN_RATIO_WARN=0.20`（20%超で警告。ゲートは任意）
- 直近 N 年の `count` 推移を週次KPIで追跡

## Collector KPI（Discovery / Harvest / Gate）

### 目的
- 自動収集ラインを**安全に**拡大するため、各段の**最低限の健全性**を可視化する。
- すべて **Step Summary**（`$GITHUB_STEP_SUMMARY`）に常設出力する。

### Discovery（探索）
- `official_rate` = 公式ソース（preview/official）候補数 ÷ 全候補数
- `hit_rate` = 正規化成功候補数 ÷ 入力クエリの総数（または探索トライ数）
- `duplicate_ratio` = 近似重複（de-dup θ≥0.85）候補数 ÷ 全候補数
- `fail_reasons_top3` = 失敗理由の上位3件（`normalization-failed` / `no-official` / `rate-limit` など）

### Harvest（収集→正規化→付与→重複）
- `with_provenance_rate` = 完全provenance（6項目）件数 ÷ 全件数
- `stub_ratio` = provider=stub 件数 ÷ 全件数
- `dedup_pairs` = 類似候補ペア総数（助言用途）
- `theta_buckets` = θ≥0.7 / θ≥0.8 / θ≥0.9 の各カウント

### Gate（採否）
- `auto_accept_rate` = 自動採用件数 ÷ 全候補数（`score ≥ θ`）
- `pr_queue_size` = PR 承認キュー送り件数（`0.50 ≤ score < θ`）
- `reject_rate` = reject 件数 ÷ 全候補数（`score < 0.50`）
- `avg_score` = 候補スコア平均（任意）

### しきい値（サンプル：WARN/CRIT）
- `official_rate`：WARN < 0.60 / CRIT < 0.40
- `with_provenance_rate`：WARN < 0.95 / CRIT < 0.90
- `stub_ratio`：WARN > 0.50 / CRIT > 0.75
- `duplicate_ratio`：WARN > 0.30 / CRIT > 0.50
- `auto_accept_rate`：WARN if `< 0.10 or > 0.90`（偏り検知）

> しきい値は **Repo Variables** や **Workflow inputs** で上書きできる設計を推奨。

### Step Summary（出力キーの標準）
- Discovery: `official_rate`, `hit_rate`, `duplicate_ratio`, `fail_reasons_top3`
- Harvest: `with_provenance_rate`, `stub_ratio`, `dedup_pairs`, `theta_buckets`
- Gate: `auto_accept_rate`, `pr_queue_size`, `reject_rate`, `avg_score`

### 出力例（抜粋）
```
### Collector KPI
- official_rate: 0.78
- hit_rate: 0.64
- duplicate_ratio: 0.12
- with_provenance_rate: 1.00
- stub_ratio: 0.18
- theta_buckets: {">=0.7":0, ">=0.8":0, ">=0.9":0}
- auto_accept_rate: 0.35
- pr_queue_size: 12
- reject_rate: 0.05
```
