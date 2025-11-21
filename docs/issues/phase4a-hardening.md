---
id: 201
issue: TBA
slug: phase4a-hardening-audio-dedup-retry-promotion
title: "Phase 4A Hardening: Audio metrics, fuzzy dedup, retry/backoff, batch promotion"
labels: ["type:task", "area:ops", "area:data", "priority:P1", "phase:4"]
status: "open"
updated: 2025-11-20
owner: "pipeline"
links:
  roadmap: ../dev/roadmap.md#phase-4---autonomous-content-pipeline計画中
---

## 概要
Phase 4A intake を本番化する前に、現状の緩和設定/未実装項目を埋めて品質を上げるハードニングタスク。

## スコープ
- Audio 品質計測を導入（LUFS/無音率/クリップ率）。計測結果が無い場合は現在は pass だが、将来のフェイル判定に使えるようにする。
- 重複判定に Levenshtein 近傍一致（タイトル+ゲーム+作曲者）を追加し、完全一致以外の微差異も除外可能にする。
- API 呼び出しのリトライ/バックオフ（2,4,8分, 最大3回）。429/一時ネットワーク障害時に tier 降格 or 翌日リトライの実装。
- ステージング→本番昇格フローの整備：batch ID 付与、R2/D1 昇格/ロールバック用の CLI/スクリプト。

## 非スコープ
- Apple Music の鍵取得・本番化（別Issueで扱う想定）
- 本格的な ML 品質スコアリング

## 成功基準
- Audio metrics が取得され、LUFS/無音率/クリップ率しきい値で guard 評価できる（デフォルトは警告+ログ、将来 fail 化できる）。
- Fuzzy dedup で重複率が ≤5% を維持しつつ誤除外がないこと。
- 429/一時障害時に自動リトライまたは tier 降格が行われ、(errors 配列に理由が残る)。
- ステージングから本番への昇格手順が Runbook に明文化され、batch ID を前提にした昇格/ロールバックが実行できる。

## 受け入れ条件
- `workers/shared/lib/intake.ts` で audio metrics のしきい値判定が有効化され、未計測時は WARN ログが出る。
- `workers/shared/lib/dedup.ts` に Levenshtein/近傍一致を追加し、Runbook に反映。
- `pipeline/src/stages/intake.ts` で fetch 系に指数バックオフ付きのリトライを実装し、429/ネットワーク失敗が自動再試行される。
- ステージング→本番昇格の CLI/スクリプトと Runbook 追記（batch ID の付け方、昇格、ロールバック）。

## メモ/補足
- LUFS/無音率計測は外部ジョブ（Queue + 解析 Worker）の導入も検討。PoC段階では計測結果を取り込める形にしておく。
