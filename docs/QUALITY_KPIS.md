# Quality KPI（品質指標とSLO）

## 目的
自動化の拡張に伴う品質劣化を**早期に検知**し、運用で矯正可能にする。

## 最小必須セット（Step Summary への出力）
- **guard**: `in/kept/drop`、`warn` 件数、主な理由トップ3
- **dedup**: `examined/dup-exact/dup-similar`、`θ_main`（実行値）
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
