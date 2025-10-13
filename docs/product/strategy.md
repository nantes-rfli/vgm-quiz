# プロダクト戦略 — vgm-quiz

- **Status**: Approved
- **Last Updated**: 2025-10-13
- **目的**: プロジェクトの長期的な方向性と不変の戦略原則を明文化

---

## 概要

本ドキュメントは、vgm-quizの進化の方向性を定義します。Phase 1で実現した「日替わり固定問題セット」から、Phase 2以降で目指す「大量ストックを活用した柔軟な出題プラットフォーム」への移行戦略を明確にし、後続の開発者が方向性を誤解しないようにします。

**重要**: 本ドキュメントの方針は、個別のIssueやPRで覆すことはできません。方針変更が必要な場合は、本ドキュメントを更新するPRを作成し、レビューと合意を得てください。

---

## ガイディング原則 (不変)

### 1. **ストック優先 (Stock-First)**

**原則**: D1に蓄積したトラックを任意条件でサンプリングし、日替わりセットは「プリセット条件の一種」として扱う。

**Phase 1 (現在)**:
- 日替わり固定問題セット (`GET /daily?date=YYYY-MM-DD`)
- curated.json → 日次Cron → R2 export → フロントエンド配信

**Phase 2+ (目指す姿)**:
- ストックプール (D1に100+トラック)
- ユーザーが条件を選択 (難易度、ジャンル、シリーズ、年代)
- サーバーが条件に合う問題を動的サンプリング
- 「日替わり」は条件プリセットの1つに過ぎない

**実装への影響**:
- データ設計: ファセット情報 (difficulty, genre, series, era) を追加
- API設計: 条件ベースのサンプリングAPI
- UI設計: フィルタ選択画面

---

### 2. **Manifest ドリブン (Manifest-Driven)**

**原則**: フロントエンドが利用可能なモード/ファセットを `GET /v1/manifest` で取得し、API契約と同期を保つ。

**なぜ重要か**:
- フロントとバックエンドの契約を明示的に定義
- バックエンドがサポートする条件をフロントが動的に取得
- 新しいファセット追加時にフロントの変更を最小化

**Manifest構造例**:
```json
{
  "schema_version": 2,
  "modes": [
    { "id": "vgm_v1-ja", "title": "VGM Quiz Vol.1 (JA)", "defaultTotal": 10 }
  ],
  "facets": {
    "era": ["80s", "90s", "00s", "10s", "mixed"],
    "difficulty": ["easy", "normal", "hard", "mixed"],
    "series": ["ff", "dq", "zelda", "mario", "mixed"]
  },
  "features": {
    "inlinePlaybackDefault": false,
    "imageProxyEnabled": true
  }
}
```

**実装への影響**:
- Phase 2で `GET /v1/manifest` を実装
- フロントはManifestを基にフィルタUIを構築
- 新ファセット追加時はManifestを更新するだけ

---

### 3. **トークン一貫性 (Token Consistency)**

**原則**: `POST /v1/rounds/start` / `POST /v1/rounds/next` はJWSトークンで進行状態を保持し、サーバーはステートレスを維持。

**Phase 1 (現在)**:
- 簡易トークン (Base64エンコード)
- 固定問題セット

**Phase 2+ (目指す姿)**:
- JWS署名付きトークン
- トークン内に条件 (mode, filters) を保持
- クライアントがトークンを保持し、サーバーは署名検証のみ

**実装への影響**:
- JWSライブラリ導入 (`workers/shared/lib/token.ts`)
- トークンペイロード設計 (mode, filters, ids, index, exp)
- Phase 1→2移行期はFeature Flagで切り替え

---

### 4. **後方互換への配慮 (Backward Compatibility)**

**原則**: 移行期間中はPhase 1の日替わり仕様を壊さず、フロントとAPIの切り替えをFeature Flagで段階的に行う。

**移行戦略**:
1. **Phase 2A**: データ整備 (Phase 1と並行稼働)
2. **Phase 2B**: 新API実装 (`/v1/manifest`, 条件ベース `/v1/rounds/start`)
3. **Phase 2C**: フロントエンド切り替え (Feature Flag `NEXT_PUBLIC_USE_MANIFEST=1`)
4. **Phase 2D**: Phase 1 API廃止 (十分な移行期間後)

**実装への影響**:
- 移行期間は両方のAPIを維持
- Feature Flagで段階的ロールアウト
- 最終的にPhase 1 APIは削除

---

### 5. **データファセット充実 (Rich Facets)**

**原則**: 難易度・ジャンル・シリーズ等のメタデータをD1/curated.jsonに追加し、フィルタ条件の妥当性を保つ。

**Phase 1 (現在)**:
- 最小メタデータ (title, game, composer, year, youtube_url, spotify_url)
- 20トラック

**Phase 2+ (目指す姿)**:
- 拡張メタデータ (difficulty, genres, seriesTags, era, platform)
- 100+トラック (Phase 2目標)
- ファセットごとに十分な問題数を確保

**実装への影響**:
- curated.json フォーマット拡張
- D1スキーマ拡張 (`track_facets` テーブル)
- データ検証スクリプト更新 (`npm run validate:curated`)

---

## Phase別の進化ロードマップ

### Phase 1 - MVP (完了 ✅)

**実現したこと**:
- 日替わり固定問題セット
- 手動キュレーション (curated.json)
- Cron自動生成 (Discovery → Publish → R2)

**制約**:
- 当日分のみ有効
- ユーザーフィルタなし
- 問題不足時は503エラー

---

### Phase 2 - ストック型クイズ運用

**ゴール**: ユーザーが条件を選択して柔軟にプレイ可能に

**Phase 2の4つのサブフェーズ**:

#### Phase 2A - データ整備
**期間**: 2025-10-14 ~ 2025-11-01 (暫定)

**主な成果物**:
- curated.jsonメタデータ拡張 (difficulty, genres, seriesTags, era)
- D1スキーマ拡張 (`track_facets` テーブル)
- データ検証スクリプト更新
- 100+トラック投入

**前提条件**:
- Phase 1との互換性維持
- Biome/tscを通す

---

#### Phase 2B - Manifest & API刷新
**期間**: 2025-11-04 ~ 2025-11-22 (暫定)

**主な成果物**:
- `GET /v1/manifest` 実装
- `POST /v1/rounds/start` 条件対応 (mode, filters, total, seed)
- JWS署名ライブラリ導入
- MSW/Playwrightモック更新

**前提条件**:
- Phase 2Aのメタデータ投入完了

---

#### Phase 2C - フロントエンド適用
**期間**: 2025-11-25 ~ 2025-12-13 (暫定)

**主な成果物**:
- モード/フィルタ選択UI
- Manifest統合 (React Query等でキャッシュ)
- 条件付きラウンド開始
- i18n文言追加

**前提条件**:
- Phase 2B API完成
- デザイン合意

---

#### Phase 2D - 品質と運用
**期間**: 2025-12-16 ~ 2026-01-10 (暫定)

**主な成果物**:
- E2Eテスト拡張 (条件別プレイシナリオ)
- メトリクス整備 (条件別分析)
- Cron再実装 (日替わりプリセット自動生成)
- 運用Runbook更新

**前提条件**:
- Phase 2A~C完了

---

### Phase 3+ - 自動化と拡張

**Phase 3 候補**:
- Spotify API統合 (Discovery/Harvest自動化)
- YouTube統合 (音声抽出、ML品質スコアリング)
- Guardステージ実装 (品質検証)
- Dedupステージ実装 (重複検出)

**Phase 4+ 候補**:
- 行動スコアリング (ML基づく難易度予測)
- 複数クイズモード (作曲者モード、年代モードなど)
- ソーシャル機能 (リーダーボード、フレンドチャレンジ)

詳細は [docs/dev/roadmap.md](../dev/roadmap.md) を参照。

---

## 決定事項と非目標

### ✅ 決定事項

1. **Manifest + Conditioned Rounds がPhase 2の中心**
   - 日替わり専用APIへの追加投資は行わない
   - すべての出題モードを統一APIで実現

2. **ストック型への段階的移行**
   - Phase 1 APIを即座に廃止しない
   - Feature Flagで段階的ロールアウト
   - 十分な移行期間 (2-4週間) を設ける

3. **データファセット拡充を優先**
   - Phase 2Aでメタデータ整備を先行
   - API実装前にデータ基盤を固める

### ❌ 非目標 (Phase 2では扱わない)

1. **リアルタイム音源ストリーミング**
   - Phase 2ではYouTube/Spotify埋め込みのみ
   - 音源取得はPhase 3で検討

2. **認証・アカウント機能**
   - ローカルストレージのみ
   - サーバー側スコア保存なし

3. **モバイルアプリ・マルチプレイ**
   - Webブラウザのみ
   - シングルプレイのみ

---

## リスクと対策

### リスク1: データ充足不足

**リスク**: ファセットごとに十分な問題数が無いと条件サンプリングが失敗

**対策**:
- `POST /v1/availability` を実装し、フィルタ選択時に利用可能問題数を表示
- 「問題数不足」のUI表示 (例: "このフィルタでは3問しか利用できません")
- バックアップ問題の充実 (#31)

---

### リスク2: JWS実装コスト

**リスク**: Phase 1のBase64トークンからJWSへの切り替えはフロント・バックで同時に進める必要がある

**対策**:
- 共有ライブラリ (`workers/shared/lib/token.ts`) を抽象化
- MSWでも同じ署名ロジックを再利用
- 移行期間はFeature Flagで切り替え

---

### リスク3: 移行期間の二重仕様

**リスク**: Legacy `GET` を残す期間は複雑度が増す

**対策**:
- Legacy API期間を短くする (2-4週間)
- Feature Flagによるロールアウト計画を明文化
- 移行完了後は即座にLegacy API削除

---

### リスク4: Cronとオンデマンドの整合性

**リスク**: Publishが R2 と D1 の整合性を保てない場合がある

**対策**:
- Phase 2Dで監視 (STORAGE head, D1 picks) を追加
- 自動補正ジョブを実装
- 不整合時のアラート (Slack/Email)

---

## 参照ドキュメント

本戦略の詳細は以下のドキュメントを参照:

- **全体計画**: [docs/dev/roadmap.md](../dev/roadmap.md) - Phase別ロードマップ
- **MVP要件**: [docs/product/requirements.md](requirements.md) - Phase 1スコープと制約
- **API仕様**: [docs/api/api-spec.md](../api/api-spec.md) - Manifest API仕様
- **Priority定義**: [docs/dev/priority-definition.md](../dev/priority-definition.md) - Issue優先度の扱い

---

## 変更履歴

- **2025-10-13**: 初版作成。`docs/product/roadmap-phase2.md` の方針を抽出し、不変の戦略として文書化
