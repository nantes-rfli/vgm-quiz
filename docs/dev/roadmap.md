# プロダクトロードマップ — vgm-quiz

- **Status**: Living Document
- **Last Updated**: 2025-10-13
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

## Phase 2 - ユーザーフィルタ + 動的サンプリング

**ゴール**: era/difficulty/seriesフィルタとフィルタに基づく動的問題サンプリングを実現

**ステータス**: 計画中

**開始予定**: Phase 1本番検証後 (1-2週間後)

### 計画中の機能

#### Backend
- [ ] **#27: Manifest API** (`GET /v1/manifest`) - *Phase 1から延期*
  - 利用可能なモード (例: `vgm_v1-ja`) を公開
  - フィルタファセット (era, difficulty, series) を公開
  - 機能フラグ (inlinePlayback, imageProxy)
  - クライアント: manifestを使ってフィルタUIを構築

- [ ] **#28: Availability API** (`POST /v1/availability`) - *Phase 1から延期*
  - 指定フィルタで利用可能な問題数を返却
  - クライアント: ラウンド開始前に「X問利用可能」を表示
  - 優先度: P3 (任意、あると便利)

- [ ] **動的サンプリング拡張**
  - Publishステージをフィルタベース選定対応に拡張
  - ファセット対応のクールダウン付きプール管理

#### Data
- [ ] **#30: Manifestデータ準備** - *Phase 1から延期*
  - モード定義 (locale, theme)
  - ファセット定義 (era: 80s/90s/00s/10s, difficulty: easy/normal/hard, series: ff/dq/zelda/mario)
  - 各ファセットのデフォルト値

- [ ] **curated.json拡充**
  - 目標: 100+トラック (現在20トラック)
  - ファセット間でバランスの取れた分布を確保
  - フィルタ組み合わせごとに4作品最小ルールを維持

#### Frontend
- [ ] **フィルタUI実装**
  - ゲーム開始前のフィルタ選択画面
  - アプリ起動時にmanifestを取得
  - フィルタを `/v1/rounds/start` に渡す

- [ ] **Manifest統合**
  - localStorageにmanifestをキャッシュ
  - バージョン変更時に再検証

#### Infrastructure
- [ ] **#26: 画像プロキシ** (`GET /proxy/image`) - *Phase 1から延期*
  - アートワークURL安定化のためのプロキシ
  - フォーマット変換 (WebP)
  - CDNキャッシュ戦略

- [ ] **アートワーク対応**
  - curated.jsonに `artwork` フィールドを追加
  - revealカードにゲームカバーアートを表示
  - 画像欠損/破損時のフォールバック

### 成功基準
- [ ] ユーザーが開始前にera/difficulty/seriesでフィルタ可能
- [ ] Availability APIが現実的な問題数を表示
- [ ] アートワークが95%以上の問題で正しく表示される
- [ ] 画像プロキシが外部リンク失敗を50%以上削減

### 依存関係
- Phase 1本番メトリクスのベースライン確立
- 希望するフィルタタイプに関するユーザーフィードバック

---

## Phase 3 - Spotify API統合

**ゴール**: DiscoveryとHarvestステージをSpotify APIで自動化

**ステータス**: 将来計画

**開始予定**: Phase 2安定化後

### 計画中の機能

#### Backend
- [ ] **Spotify API統合**
  - OAuth2認証
  - プレイリスト発見
  - トラックメタデータ拡充

- [ ] **Discoveryステージ自動化**
  - 定期的なSpotifyプレイリストスキャン
  - プレイリスト人気度ベースの優先度スコアリング

- [ ] **Harvestステージ実装**
  - Spotify APIからトラックメタデータを取得
  - プレビューURL保存 (30秒クリップ)
  - メタデータ正規化 (作曲者、ゲームタイトル抽出)

#### データパイプライン
- [ ] **Guardステージ** (品質チェック)
  - ルールベース検証 (メタデータ完全性)
  - エッジケース用の手動レビューキュー

- [ ] **Dedupステージ** (重複検出)
  - タイトル/ゲームで類似トラックをクラスタリング
  - 正規トラック選択

#### Data
- [ ] 100%手動キュレーションからハイブリッドモデルへ移行
- [ ] curated.jsonをシード/フォールバックデータとして維持

### 成功基準
- [ ] パイプラインが週50+トラックを自動発見
- [ ] Guardステージが95%以上のメタデータ品質を維持
- [ ] Dedupステージが重複を80%以上削減

---

## Phase 4+ - 将来の拡張

**ステータス**: バックログ / アイデア

### 候補機能

#### コンテンツ拡張
- [ ] YouTube統合 (音声抽出、ML品質スコアリング)
- [ ] Apple Music統合
- [ ] ユーザー投稿トラック (モデレーション必要)

#### ゲームプレイ
- [ ] 複数クイズモード (作曲者モード、年代モードなど)
- [ ] ユーザーパフォーマンスベースの難易度調整
- [ ] コンボ/連続正解ボーナス

#### ソーシャル
- [ ] リーダーボード (サーバー側スコア保存)
- [ ] SNSシェア
- [ ] フレンドチャレンジ

#### 運用
- [ ] 行動スコアリング (ML基づく難易度予測)
- [ ] 自動スケジューリング (最適な問題ローテーション)
- [ ] パイプライン障害アラート (Slack/Emailウェブフック)
- [ ] メトリクスダッシュボード (Grafana/Cloudflare Analytics)

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

- **2025-10-13**: 初回ロードマップ作成、Phase 1完了マーク、Phase 2計画開始
