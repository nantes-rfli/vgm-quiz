# Phase 2 Completion Checklist

- Status: In Progress
- Last Updated: 2025-11-11

## 概要

Phase 2（フィルタ UI + Manifest 統合）の完成度を確認するためのチェックリスト。各機能実装後、該当項目をチェックし、最終的にすべての項目が ✅ になることを目指す。

---

## Phase 2A: Manifest & API (Backend)

### API エンドポイント実装
- [ ] `GET /v1/manifest` — Manifest レスポンス実装 + キャッシュ設定
- [ ] `POST /v1/rounds/start` — フィルタパラメータ受け入れ + 検証
- [ ] フィルタ値のマニフェスト照合
- [ ] Difficulty & Era は単一値のみ（複数指定時は 400 エラー）
- [ ] Series は複数値をサポート
- [ ] `"mixed"` 値をフィルタリング（全選択を意味するため）

### トークン仕様
- [ ] `filtersKey` を JWS ペイロードに追加
- [ ] `filtersHash` を JWS ペイロードに追加
- [ ] R2 キー生成: `exports/{date}_{filtersHash}.json`

### エラーハンドリング
- [ ] `400 bad_request` — フィルタ形式エラー
- [ ] `503 no_questions` — 指定フィルタに該当質問なし
- [ ] `422 insufficient_inventory` — リクエスト数が利用可能数を超過
- [ ] JSON Pointer で詳細なエラー位置を返却

### データベース・ストレージ
- [ ] D1 `picks` テーブルに filters_json + items を保存
- [ ] R2 に `exports/{date}_{hash}.json` を保存
- [ ] 整合性チェック: R2 ミス時に D1 フォールバック

---

## Phase 2B: Manifest & Filter UI (Frontend)

### Manifest 統合
- [x] `useManifest()` Hook 実装 (web/src/features/quiz/api/manifest.ts)
- [x] `/v1/manifest` 取得 + キャッシュ戦略
  - [x] localStorage 24 時間キャッシュ
  - [x] 5 分ごとにバックグラウンド再フェッチ
  - [x] ネットワーク失敗時は `DEFAULT_MANIFEST` フォールバック
- [ ] **[Phase 2D-Future]** `schema_version` 変更検知 → フィルタリセット

### フィルタ状態管理
- [x] `FilterContext` + `useFilter()` Hook 実装 (web/src/lib/filter-context.tsx)
- [x] `difficulty` — 単一選択（easy/normal/hard/mixed）
- [x] `era` — 単一選択（80s/90s/00s/10s/20s/mixed）
- [x] `series` — 複数選択（ff/dq/zelda/mario/sonic/pokemon）
- [x] フィルタリセット機能
- [x] デフォルト値: すべて mixed（全選択）

### フィルタ選択 UI
- [x] `FilterSelector` コンポーネント実装 (web/src/components/FilterSelector.tsx)
- [x] Manifest 上の facets でドロップダウン生成
- [x] ユーザー選択値をバリデーション
- [ ] **[Phase 2D-Future]** 利用可能な質問数を表示（推定値）— Availability API との連携検討
- [x] 無効なフィルタ値は自動リセット

### i18n 文言
- [x] 日本語: `web/locales/ja.json` に filter キー追加 (#113, #114)
- [x] 英語: `web/locales/en.json` に filter キー追加 (#113, #114)
  - [x] `filter.title`, `filter.description`
  - [x] `filter.difficulty.{label, easy, normal, hard, mixed}`
  - [x] `filter.era.{label, 80s, 90s, 00s, 10s, 20s, mixed}`
  - [x] `filter.series.{label, ff, dq, zelda, mario, sonic, pokemon, mixed}`
  - [x] `filter.availability`, `filter.insufficient`, `filter.start`

---

## Phase 2C: Documentation & Polish

### フロントエンドドキュメント
- [ ] `docs/frontend/play-flow.md` を更新
  - [ ] Manifest 取得フロー追加
  - [ ] フィルタ選択フロー追加
  - [ ] ラウンド開始フロー更新
- [ ] `docs/frontend/state-management.md` を新規作成
  - [ ] フィルタ状態管理
  - [ ] Manifest キャッシュ戦略
  - [ ] フロント ↔ バック同期

### API ドキュメント
- [ ] `docs/api/api-spec.md` を更新
  - [ ] フィルタリクエストスキーマ
  - [ ] フィルタ検証ルール
  - [ ] フィルタレスポンス
  - [ ] トークンペイロードの filters* フィールド説明

### データモデルドキュメント
- [ ] `docs/data/model.md` を更新
  - [ ] `Manifest` スキーマ
  - [ ] `FilterOptions` スキーマ
  - [ ] `Round` スキーマ（filters フィールド）
  - [ ] JSON 例を追加

### プロジェクト概要ドキュメント
- [ ] `CLAUDE.md` を更新
  - [ ] Backend セクション: Phase 2 説明
  - [ ] State Management セクション: フィルタ + Manifest 追加
  - [ ] API Integration セクション: 3エンドポイント説明
  - [ ] Storage Strategy: Manifest キャッシュ追加
  - [ ] Documentation: 新規ドキュメントへのリンク

### チェックリスト
- [ ] `docs/dev/phase2-checklist.md` を新規作成（このファイル）

### ドキュメント品質
- [ ] リンク切れ確認（相互参照）
- [ ] マークダウンリンターが通る
- [ ] コード例がすべて正確（JSON/TypeScript）
- [ ] フロント・バック用語の統一（filters, facets, Manifest）

---

## Phase 2D: テスト & 品質保証

### 未実装機能の完成（Phase 2D-Future）
- [ ] `schema_version` 変更検知とフィルタ自動リセット ([issue #115](https://github.com/anthropics/claude-code/issues/115))
  - [ ] useManifest が schema_version の変化を検知
  - [ ] FilterContext の無効なフィルタ値を自動リセット
  - [ ] ユーザー通知メッセージの実装
- [ ] 利用可能な質問数表示 (Availability API 連携)
  - [ ] `/v1/availability` エンドポイントの実装 (バックエンド)
  - [ ] FilterSelector で「推定値」ではなく「実値」を表示
  - [ ] キャッシュとの同期戦略の検討

### E2E テスト
- [ ] フィルタ選択フロー
  - [ ] Difficulty 選択 → API 送信
  - [ ] Era 選択 → API 送信
  - [ ] Series 複数選択 → API 送信
  - [ ] フィルタリセット
- [ ] Manifest キャッシュ
  - [ ] 初回フェッチ + キャッシュ
  - [ ] キャッシュからの復帰
  - [ ] schema_version 変更検知
- [ ] エラーシナリオ
  - [ ] Manifest 取得失敗 → フォールバック
  - [ ] フィルタ検証失敗 → リセット
  - [ ] API 503 no_questions

### 型安全性
- [ ] FilterOptions 型定義
- [ ] Manifest 型定義
- [ ] Token.filtersKey / filtersHash 型
- [ ] TypeScript strict mode で通過

### バックエンド検証
- [ ] フィルタ値のマニフェスト照合
  - [ ] 有効な値を受け入れ
  - [ ] 無効な値を 400 エラー
- [ ] 複数値制限
  - [ ] difficulty > 1 → エラー
  - [ ] era > 1 → エラー
  - [ ] series 複数値 → OK
- [ ] R2/D1 クエリ
  - [ ] `exports/{date}_{hash}.json` を読める
  - [ ] D1 `picks` テーブルをフォールバック

---

## Phase 2E: デプロイ & 本番確認

### ステージング環境
- [ ] バックエンド (Cloudflare Workers) デプロイ
- [ ] フロントエンド (Vercel) デプロイ
- [ ] エンドツーエンドテスト
  - [ ] Manifest 取得確認
  - [ ] フィルタ選択 → API 呼び出し
  - [ ] 回答提出 → リビール表示

### 本番環境
- [ ] バックエンド デプロイ
- [ ] フロントエンド デプロイ
- [ ] ユーザー機能テスト
  - [ ] フィルタ選択が機能
  - [ ] キャッシュが効いている（network パネル確認）
  - [ ] エラー時のフォールバック

---

## Phase 2 成功基準

Phase 2C が完了したと判定する条件（**Phase 2D の機能は除外**）：

### 実装完了（Phase 2A/2B）
- ✅ ユーザーが `/play` でフィルタを選択可能
- ✅ フィルタが API に送信され、フィルタ済み質問を受け取る
- ✅ Manifest がキャッシュされ、オフライン時も基本 UI が機能
- ✅ フィルタ値の変更時に UI が自動更新
- ✅ FilterContext + useFilter() で フロント状態管理
- ✅ useManifest() で Manifest キャッシュ管理

### ドキュメント完成（Phase 2C）
- ✅ API 仕様書（`docs/api/api-spec.md`）が実装と同期
- ✅ Token 仕様（`docs/api/rounds-token-spec.md`）が HMAC-SHA256 + DJB2 で統一
- ✅ データモデル（`docs/data/model.md`）が FilterOptions/Manifest/Round を定義
- ✅ フロント仕様書（`docs/frontend/play-flow.md`, `state-management.md`）が状態遷移を説明
- ✅ CLAUDE.md が Phase 2 機能を記載
- ✅ Phase 2C Checklist が Phase 2D-Future 項目を明確化

### Phase 2D で追加予定
- [ ] `schema_version` 変更検知 (Issue #115)
- [ ] 利用可能な質問数表示 (Availability API 連携)
- [ ] E2E テスト拡張
- [ ] パフォーマンス検証

---

## 関連 Issue

- #113 - FE-01: Implement filter-aware quiz selection UI
- #114 - FE-02: Integrate Manifest caching and versioning
- #127 - BE-07: Implement filter-aware Rounds API with manifest endpoint
- #118 - DOCS-01: Update documentation and i18n for Phase 2 features

---

## 次フェーズ（Phase 3+）

Phase 2 完了後、以下が検討課題：

- **Phase 3**: YouTube 統合、音声ダウンロード、品質スコアリング
- **Complex Filtering**: 複合フィルター（AND ロジック）
- **Analytics**: ユーザーのフィルタ選択傾向分析
- **A/B Testing**: フィルタ UI/UX 改善の A/B テスト
