# プロダクトロードマップ — vgm-quiz

- **Status**: Living Document
- **Last Updated**: 2025-11-20
- **目的**: プロジェクトの各フェーズにおける機能実装を追跡

---

## 概要

本ドキュメントは、MVPから将来のフェーズまでのプロジェクトの進化を追跡します。各フェーズは前のフェーズの上に構築され、後方互換性を維持しながら新機能を追加します。

---

## Phase 1 - MVP (完了 ✅)

**ゴール**: 手動キュレーション + 固定問題セット方式でMVPをリリース

**期間**: 2025-09 ~ 2025-10 (完了)

### 完了した機能

#### Backend
- ✅ #24: Tokenized Round API (`/v1/rounds/start`, `/v1/rounds/next`) - ステートレスなクイズフロー
- ✅ #25: メトリクス収集API (`/v1/metrics`) - 冪等性対応のバッチイベント収集
- ✅ Pipeline Worker + Cron Triggers - 日次自動問題生成
- ✅ Discovery stage - curated.json → D1 同期
- ✅ Publish stage - 問題選定 + 選択肢生成 + R2 エクスポート
- ✅ D1 データベーススキーマ - sources, tracks_normalized, pool, picks, exports
- ✅ R2 ストレージ戦略 - SHA-256整合性チェック付き日次問題セット

#### Data
- ✅ #29: curated.json 初期データセット - 20トラック (作曲者、ゲーム、リンク含む)
- ✅ 4作品最小ルール検証 - 選択肢生成には4つ以上のユニークなゲームタイトルが必要

#### Frontend
- ✅ クイズフロー統合 - Phase 1 APIとの統合 + エラーハンドリング
- ✅ メトリクスクライアント - 指数バックオフ + オフラインキュー付きバッチ送信
- ✅ E2Eテストスイート - MSWスタブ付きPlaywrightテスト
- ✅ アクセシビリティベースライン - play/resultフローのWCAG AA準拠

#### ドキュメント
- ✅ Phase 1実装計画 - [phase1-implementation.md](phase1-implementation.md)
- ✅ Cron Triggersテストガイド - [cron-triggers-testing.md](../backend/cron-triggers-testing.md)
- ✅ API仕様 - [api-spec.md](../api/api-spec.md)
- ✅ メトリクスクライアント仕様 - [metrics-client.md](../frontend/metrics-client.md)

### 継続中 (Phase 1 → 2 移行期)
- ⏸️ #65: ランタイム型ガード - TypeScript型定義は存在、zodバリデーションはPhase 2に延期

---

## Phase 2 - ユーザーフィルタ + 動的サンプリング（完了 ✅）

**ゴール**: era/difficulty/series ベースのフィルタ機能と条件付きサンプリングを提供し、Phase 1 の固定ラウンドを段階的に置き換える。

**ステータス**: Phase 2A〜2D すべて完了（2025-11-15 クローズ）

### サブフェーズ別の状況と担当Issue

#### Phase 2A - データ整備（完了 ✅）
- ✅ #107 DATA-03: curated.json メタデータ拡張
- ✅ #108 BE-04: D1 スキーマに track_facets 追加
- ✅ #109 DATA-04: メタデータ検証スクリプト更新
- ✅ #110 DATA-05: curated.json を 100+ トラックに拡充

#### Phase 2B - Manifest & API 刷新（完了 ✅）
- ✅ #111 BE-05: フィルタ対応の動的サンプリング実装（Publish ステージ拡張、2025-10-30 クローズ）
- ✅ #112 BE-06: JWS 署名付きトークンライブラリ導入（2025-11-02 クローズ／2025-10-31 マージ）
- ✅ #117 FE-03: Manifest / Rounds API 仕様に沿った MSW + Playwright 更新（2025-11-02 クローズ／2025-10-31 マージ）
- ✅ #28 API-02: Availability API（任意 / P3）実装完了（2025-11-02 クローズ／マージ）

#### Phase 2C - フロントエンド適用（完了 ✅）
- ✅ #113 FE-01: フィルタ選択 UI 実装
- ✅ #114 FE-02: Manifest キャッシュとバージョン管理
- ✅ #118 DOCS-01: Phase 2 機能向けドキュメント & i18n 更新

#### Phase 2D - 品質と運用（完了 ✅）
- ✅ #115 QA-01: フィルタ別シナリオの E2E テスト拡張（2025-11-14 クローズ）
- ✅ #116 OPS-01: プリセット生成 Cron の再設計（条件付きラウンド対応、2025-11-15 クローズ）

### 成功基準
- ✅ ユーザーが開始前に era / difficulty / series でフィルタ指定できる
- ✅ Availability API で条件ごとの在庫を提示できる（任意だが推奨）
- ✅ JWS 署名トークンと MSW / E2E モックが同期し、期待通りに検証が通る
- ✅ 条件付き Publish / Cron が安定稼働し、手動介入なしで日次配信できる

### 依存関係
- Phase 1 本番メトリクスのベースライン確立
- フィルタ UX に関するユーザーフィードバック
- workers / web 間の共有ライブラリ構成（@vgm-quiz/shared）

---

## Phase 3 - Observability & Guardrails

**ゴール**: 完全自動クイズ生成へ進む前に、現行フィルタ配信を計測・監視可能にし、失敗時でも即復旧できる体制を築く。手動介入ゼロで安定運用できる仕組みを整備する。

**ステータス**: Phase 3A〜3D 完了（2025-11-19 クローズ）

**開始予定**: Phase 2 安定確認後すぐ（2025-11 下旬見込み）

### サブフェーズ別の状況と担当Issue

#### Phase 3A - 観測性基盤（完了 ✅）
- ✅ #75 Ops: Web Vitals & custom performance marks（P2, area:ops、2025-11-16 クローズ）
- ✅ #76 Ops: CI Lighthouse smoke tests（P2, area:ops、2025-11-16 クローズ）
- ✅ #134 OPS-03: Observability dashboard & Slack alerts（P2, area:ops、2025-11-16 クローズ）

#### Phase 3B - Guardrails（完了 ✅）
- ✅ #65 FE: Runtime type guards for API responses（P1, area:fe、2025-11-16 クローズ）
- ✅ #77 FE: Contract tests for metrics/reveal payloads（P2, area:fe、2025-11-16 クローズ）
- ✅ #135 FE-Guardrails: Enforce contract tests in CI（P2, area:fe、2025-11-16 クローズ）

#### Phase 3C - Runbook & Metrics Docs（完了 ✅）
- ✅ #32 DOCS-01: quality/metrics.md（P2, area:docs、2025-11-18 クローズ）
- ✅ #33 DOCS-02: measurement-plan.md（P2, area:docs、2025-11-18 クローズ）
- ✅ #35 DOCS-04: audio-playback runbook（P2, area:docs、2025-11-16 クローズ）
- ✅ #37 OPS-02: レート制限/署名鍵ローテーション運用メモ（P3, area:ops、2025-11-18 クローズ）

#### Phase 3D - データ冗長性（完了 ✅）
- ✅ #31 DATA-03: バックアップ在庫追加（P3, area:data、2025-11-19 クローズ）
- ✅ #136 DATA-Backup-Automation: retain 14d of daily presets（P2, area:data、2025-11-19 クローズ）

### 成功基準
- Lighthouse/Perf smoke がCIで自動実行され、しきい値超過時にアラート/ブロックできる
- Web Vitals・custom metrics が集計され、目標値とアラートしきい値が定義済み
- `/v1/rounds/start` とメトリクスイベントのランタイム型検証が追加され、検証失敗時のログ/アラートが用意されている
- Runbookとメトリクス定義が公開され、オンボーディング無しで運用可能
- バックアップ在庫（R2スナップショット）が「自動生成停止後も少なくとも14日分の新規ラウンド」を供給できる

---

## Phase 4 - Autonomous Content Pipeline（計画中）

**ゴール**: 「完全自動でデータ収集・作問・配信し続ける」仕組みを、Phase 3 の観測性/ガードレールの上で段階的に本番化する。

**ステータス**: Phase 4A〜4C 計画中（2025-11-20 キックオフ、Issueドラフト作成済み）

> 注記: docs/ops/api-security-operations.md の「Phase 4A/4B」はレート制限最適化トラック（Ops）を指し、本ロードマップの 4A/4B/4C（Content/Gameplay/Social）とは別系列。混同防止のため、Ops トラックは「Ops-4A/4B」と表記する。

### サブフェーズ別計画（優先順）

#### Phase 4A - マルチソース自動収集 (Content Acquisition Automation)
- 1〜2ソース（候補: Spotify / YouTube）で Discovery → Harvest → Guard → Dedup のPoCを実装し、R2/D1への安全な取り込み枠を確立
- ライセンス/レート制限/OAuth を Runbook 化し、失敗検知・リトライ・ロールバックをPhase 3基盤に接続
- 成功指標: 追加トラック数/週、重複率、失敗率、MTTR、取り込み後の品質監査パス率
- ソース優先順位: YouTube → Spotify → Apple Music（公式チャンネルを優先、次にレーベル系、高品質プレイリストでフェイルオーバー）。収集クォータ枯渇時は翌日リトライと対象縮小で回避
- 2025-11-20 現在の進捗: YouTube(Final Fantasy X OST) 88/88 pass、Spotify(Nobuo Uematsu artist top-tracks, market=JP) 10/10 pass を本番しきい値で確認し pipeline cron デプロイ済み。未実装のハードニング項目（音声計測、近傍一致 dedup、指数バックオフ、昇格フロー整備）は Issue「Phase 4A Hardening: Audio metrics, fuzzy dedup, retry/backoff, batch promotion」で管理。

#### Phase 4B - 適応型ゲームプレイ (Adaptive Gameplay MLP)
- 行動データを用いた難易度オートチューニングの最小実装＋新モード1種（例: 作曲者モード or 年代モード）
- A/B 計測を組み込み、離脱率・正答率・プレイ時間で効果を評価
- 成功指標: 試験群での完走率/再訪率の改善、意図した難易度帯への収束
- モード選定: 作曲者モードで進行（Spotify 取り込み後にメタ精度向上を再同期）

#### Phase 4C - シェアチャレンジ & 軽量ソーシャル (Social & Sharing v1)
- チャレンジリンク生成と共有計測（OGP最適化含む）を最小構成で提供
- 不正防止を簡易ガード（署名付きチャレンジパラメータ）で実装し、将来のリーダーボード拡張に備える
- 成功指標: 共有率、共有経由CTR、共有経由完走率、フェイルセーフ発火件数

### 成功基準（Phase 4 全体）
- 新規ソース経由の自動取り込みが日次で安定稼働し、手動介入ゼロに近づいている
- 追加モード/適応難易度で KPI（完走率/再訪率）が統計的に有意な改善を示す
- シェア導線からの再訪・新規流入が測定され、異常検知とロールバック手順が整備済み

### ガードレール
- 各サブフェーズは Proof-of-Concept → ガード付き本番化の順で進め、Phase 3 のメトリクス／Runbook を必須前提とする
- 新規ソースや機能は計測・失敗検知・ロールバック手順を実装した上で段階的に有効化

---

---

## フェーズ移行チェックリスト

次のフェーズに移行する際:

1. **本番検証**
   - [ ] Phase N を本番環境にデプロイ
   - [ ] 成功メトリクスのベースライン確立
   - [ ] クリティカルバグの解決

2. **ドキュメントレビュー**
   - [ ] アーキテクチャドキュメント更新
   - [ ] API仕様が現在の実装を反映
   - [ ] 運用問題用のランブック作成

3. **バックログ整理**
   - [ ] Phase N+1 のIssue作成/洗練
   - [ ] 依存関係の特定
   - [ ] 新フェーズ内での優先度設定

4. **チームコミュニケーション**
   - [ ] Phase N+1 キックオフミーティング
   - [ ] タイムラインとスコープの確認
   - [ ] 成功基準の合意

---

## 関連ドキュメント

- [Product Requirements](../product/requirements.md) - MVPスコープと成功メトリクス
- [Backend Architecture](../backend/architecture.md) - システム設計概要
- [Phase 1 Implementation Plan](phase1-implementation.md) - Phase 1詳細計画
- [Priority Definition](priority-definition.md) - P0/P1/P2/P3ラベルの解釈方法

---

## 変更履歴

- **2025-11-11**: Phase 2C 完了（#113, #114, #118 マージ、全3タスク完了）、Phase 2D 開始（#115 QA-01取組開始）
- **2025-11-16**: Phase 3A/3B 完了 (#75, #76, #134, #65, #77, #135 クローズ)。Phase 3C/3D 計画中に更新。
- **2025-11-20**: Phase 3A〜3D クローズを反映し Phase 4 (4A/4B/4C) 計画を追加、キックオフ。
- **2025-11-02**: Phase 2B 完了（#28 API-02 マージ、全4タスク完了）、Phase 2C 開始準備
- **2025-10-22**: Phase 2A 完了状況と Phase 2B〜2D の担当 Issue を更新、成功基準を現行バックログと整合
- **2025-10-13**: 初回ロードマップ作成、Phase 1完了マーク、Phase 2計画開始
