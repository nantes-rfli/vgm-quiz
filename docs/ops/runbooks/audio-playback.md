# Runbook: 音声埋め込み失敗の初動対応

**ステータス**: Phase 3C 初版
**対象バージョン**: Phase 2B 以降
**最終更新**: 2025-11-16

---

## 目的

YouTube 埋め込みプレイヤーが表示されず、ユーザーがリンク経由で外部サービスへ遷移する頻度の増加を検知し、原因を特定・対応する。

---

## 検知と監視

### メトリクスキー

Reveal Card で以下のイベントを記録：

| イベント | 発火条件 | 属性 | 含意 |
|---------|---------|------|------|
| `embed_fallback_to_link` | インライン再生有効 + URL が YouTube 形式に変換できない | `reason: "no_embed_available"`, `provider: "youtube"`, `questionId` | ソースデータの URL が不正またはプロバイダが YouTube 以外 |
| `embed_error` | iframe src が設定されたが iframe.onError が発火 | `reason: "load_error"`, `provider: "youtube"`, `questionId` | YouTube 動画が削除/非公開/年齢制限/地域制限など |
| `reveal_open_external` | ユーザーが「Open in X」リンククリック | `provider: "youtube"` | ユーザーが外部サービスへ遷移（埋め込み成功/失敗問わず） |

### ダッシュボード・アラートの設定例

1. **Embed Fallback Rate** (`embed_fallback_to_link` / `reveal_view`)
   - 目標: < 5% per day
   - しきい値: 5% 以上で Slack #vgm-ops に注意通知
   - アクション: データ品質チェック（URL 修正が必要か確認）

2. **Embed Load Error Rate** (`embed_error` / `embed_attempt`)
   - 目標: < 2% per day
   - しきい値: 3% 以上で Slack #vgm-ops に警告通知
   - アクション: YouTube 動画の可用性確認（削除/制限）

3. **External Open Rate** (`reveal_open_external` / `reveal_view`)
   - 参考指標（必ずしも問題ではない）
   - > 80% が外部へ遷移している場合: インライン再生設定の確認

---

## 原因の切り分け

### シナリオ 1: embed_fallback_to_link が多発

**症状**
- ダッシュボードで `embed_fallback_to_link` の割合が 5% を超えている
- YouTube 埋め込みが一切表示されない

**調査手順**

1. **フロントエンド確認**
   - ユーザー設定で「インライン再生」が有効か？
     - 無効な場合: 埋め込みは試行されないので正常。`reveal_open_external` 率が高いのは問題なし。
     - 有効な場合: 次へ進む。

2. **URL 形式確認**
   - [meta.ts](../../web/mocks/fixtures/rounds/meta.ts) の links 配列内の YouTube URL が正規形か確認
   - 正規形（youtube.com/watch?v=ID または youtu.be/ID）以外の場合、修正が必要
   ```javascript
   // ✅ 正規形
   { provider: 'youtube', url: 'https://www.youtube.com/watch?v=<VIDEO_ID>' }
   { provider: 'youtube', url: 'https://youtu.be/<VIDEO_ID>' }

   // ❌ 非対応形式
   { provider: 'youtube', url: 'https://youtube.com/embed/<VIDEO_ID>' }
   { provider: 'youtube', url: 'https://youtube.com/v/<VIDEO_ID>' }
   ```

3. **コード確認**
   - [web/src/components/RevealCard.tsx](../../web/src/components/RevealCard.tsx) の `toYouTubeEmbed()` 関数が URL を正しく処理しているか
   - ローカルで MSW に `embed_fallback_to_link` イベントがログに出るか確認
   ```bash
   npm run dev
   # ブラウザの DevTools → Network タブで /metrics リクエスト検査
   ```

**対応**
- URL が不正な場合: workers/data/curated.json を修正し、Deploy
- インライン再生が無効な場合: ユーザーへ有効化を推奨（設定画面で toggle 操作）

---

### シナリオ 2: embed_error が多発

**症状**
- ダッシュボードで `embed_error` の割合が 3% を超えている
- YouTube 埋め込みフレームが読み込まれるが「動画が見つかりません」的なエラー

**調査手順**

1. **埋め込みの動作確認**
   - 問題の questionId を特定
   - [meta.ts](../../web/mocks/fixtures/rounds/meta.ts) でその questionId の YouTube URL を確認
   - 実際にその URL をブラウザで開き、動画が再生可能か確認

2. **動画が再生不可能な場合（削除/非公開など）**
   - YouTube から削除・非公開に
   - 年齢制限が有効
   - 特定国での地域制限

   **対応**:
   - 別の YouTube リンク（同じ作品の他バージョン）があれば workers/data/curated.json の該当トラック行を修正
   - なければ、links 配列から問題の YouTube URL を削除し、他のプロバイダ（Spotify など）に依存させる

3. **埋め込みが成功すべきなのに iframe.onError が発火する場合**
   - ローカル環境での再現確認
   ```bash
   npm run test:e2e -- --grep "embed"
   ```
   - MSW モック内で YouTube 埋め込みを強制失敗させ、エラーハンドラが動作するか確認
   - 本番環境の場合: CORS/CSP ポリシーが iframe.src ブロックしていないか確認
     - web/next.config.ts の Security Headers を確認
     - iframe allow 属性が必要な権限を許可しているか確認（[RevealCard.tsx](../../web/src/components/RevealCard.tsx) 参照）

**対応**
- 削除/制限された動画: curated.json から URL 削除、別リンクに置き換え
- CORS/CSP 問題: セキュリティヘッダ調整（本番デプロイ時に検証が必要）

---

### シナリオ 3: reveal_open_external 率が異常に高い

**症状**
- ダッシュボードで `reveal_open_external` が 80% を超えている
- ほぼすべてのユーザーが外部リンククリック

**調査手順**

1. **インライン再生設定の確認**
   - localStorage の `vgm2.settings.inlinePlayback` を確認（0 = 無効, 1 = 有効）
   - ブラウザ設定画面で「インライン再生」が無効になっていないか確認

2. **embed 関連イベントの数値確認**
   - `embed_fallback_to_link` + `embed_error` の合計が高い → シナリオ 1 or 2 の対応
   - 両者が低い → インライン再生が無効、または埋め込みが成功しているのに外部クリックが多い（UX 問題かもしれない）

**対応**
- インライン再生が無効な場合: ユーザー教育（設定画面で有効化方法を案内）
- 埋め込みが成功しているのに外部クリックが多い場合: UI/UX リビュー（「開く」ボタンが目立ちすぎていないか、など）

---

## 復旧手順

### パターン A: URL 修正（データ品質）

1. **問題の URL を特定**
   ```bash
   cd workers
   npm run validate:curated
   ```

2. **workers/data/curated.json を修正**
   ```json
   {
     "title": "Battle Theme",
     "links": {
       "youtube": "https://www.youtube.com/watch?v=CORRECTED_VIDEO_ID"
     }
   }
   ```

3. **検証と deploy**
   ```bash
   cd workers
   npm run validate:curated
   npm run typecheck
   npm run deploy:api
   npm run deploy:pipeline
   ```

4. **フロントエンド MSW モック更新**
   - [meta.ts](../../web/mocks/fixtures/rounds/meta.ts) も同期
   ```bash
   cd web
   npm run build && npm run test:e2e
   ```

### パターン B: 削除/制限動画の置き換え

1. **別のプロバイダリンクを探す**
   - 同じ作品の Spotify/Apple Music リンク
   - 別の YouTube ミラー（公式チャンネルなど）

2. **curated.json を更新**
   ```json
   {
     "title": "Battle Theme",
     "links": {
       "spotify": "https://open.spotify.com/track/...",
       "appleMusic": "https://music.apple.com/..."
     }
   }
   ```

3. **確認と deploy**
   - ローカル MSW で確認
   - E2E テストで reveal フロー動作確認
   - 本番 deploy

---

## メトリクス確認方法

### ローカル開発環境

1. **metrics クライアント動作確認**
   ```bash
   cd web
   npm run dev
   # ブラウザ DevTools → Application → Local Storage
   # vgm2.metrics.queue に pending イベントが溜まっているか確認
   ```

2. **MSW ハンドラ確認**
   ```bash
   # web/mocks/handlers.ts で /v1/metrics のハンドラをチェック
   grep -A 10 "POST.*metrics" web/mocks/handlers.ts
   ```

3. **イベント送信ログ**
   ```bash
   # ブラウザコンソールで
   localStorage.getItem('vgm2.metrics.queue')
   ```

### 本番環境

- Grafana Cloud Dashboard で以下を表示
  - `embed_fallback_to_link` の 24h 集計（日時別・provider 別）
  - `embed_error` の 24h 集計
  - `reveal_open_external` の 24h 集計
  - 日別トレンド（低下傾向なら改善、上昇なら悪化）

---

## エスカレーション

| 条件 | 判断 | 対応 |
|------|------|------|
| embed 関連イベント合計が 1 日 100 件以上 | Critical | 緊急対応：データ修正 → 検証 → デプロイ |
| embed 関連イベント割合が 5% 以上（毎日継続） | High | 翌営業日対応：原因調査 → 修正計画 |
| embed 関連イベント割合が 2～5%（散発的） | Medium | 定期レビュー対象：月次まとめて修正 |
| embed 関連イベント割合が 2% 未満 | Normal | 監視継続 |

---

## 関連ドキュメント・リソース

- [RevealCard コンポーネント](../../web/src/components/RevealCard.tsx) - 埋め込み実装
- [メトリクスクライアント](../../web/src/lib/metrics/metricsClient.ts) - イベント送信
- [curated.json](../../workers/data/curated.json) - マスターデータ
- [API 仕様 - /v1/metrics](../../api/api-spec.md) - メトリクス受け入れスキーマ
- [Observability & Alerts](../observability.md) - ダッシュボード・アラート設定

---

## 変更履歴

- **2025-11-16**: Phase 3C 初版作成（Issue #35）
