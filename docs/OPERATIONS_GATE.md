# OPERATIONS: Gate（自動採用 vs PR 承認）

## 目的
- Collector の最終段で **θ にもとづく自動採否**を行い、量を安全に拡大する。

## 入力（Workflow想定）
- `collector_gate_threshold`（string, optional）: 例 `0.72`。空なら**採否はログのみ**（dry-run相当）。
- 将来: Repo Variables `COLLECTOR_GATE_THRESHOLD` を既定値として参照。

## 振る舞い
1. 候補ごとに `score` を算出（SPEC_NOTABILITY.md の式）。
2. `score ≥ θ` は **自動採用**（Pool に追記）  
   `0.50 ≤ score < θ` は **PR 承認**（ブランチ作成→PR作成、ラベル `queue:collector`）  
   `score < 0.50` は **reject**（ログのみ）
3. Step Summary に `auto_accept_rate` / `pr_queue_size` / `reject_rate` を出力。

## フェイルセーフ
- **プロバイダ障害**: リトライ後に `unknown` と判定して PR キューへ（reject しない）。
- **データ不整合**: provenance 欠落は**即 reject**（要Discovery/Harvest 側の補正）。
- **しきい値ミス設定**: Inputs が不正（非数値）の場合は**dry-runモード**にダウングレード。

## PR 運用
- ブランチ命名例: `collector/auto/{YYYYMMDD-HHmm}/{short-hash}`
- ラベル: `queue:collector`, `docs:skip`（コード差分がない場合）
- 差分なし（全件既存/近似重複）なら PR をスキップ。

## KPI（出力項目）
- `auto_accept_rate`, `pr_queue_size`, `reject_rate`, `avg_score`（任意）
- Collector 全体KPIは `QUALITY_KPIS.md` の Collector 章に統合（別Issue）。


## 運用方針（v1.11 最終）

### Canonical（残すもの）
- **collector (discovery dry-run)**
- **collector (gate from artifact by id - REST)** ← これを標準の Gate ワークフローとする

### Deprecated（削除対象）
- collector (gate)
- collector (gate from artifact)
- collector (gate from artifact robust)
- collector (gate from artifact by id)

> 理由：artifact 取得や inputs 伝搬の相性課題があり、by-id + REST 版で集約しました。
