# Embed Policy and Fallback — 最小仕様
- Status: Approved
- Last Updated: 2025-09-20

本書は結果画面での**外部メディア導線**の挙動を定義します。MVPでは**クイズ中の埋め込みを禁止**し、結果画面のみ埋め込み/リンクを提供します。

## 基本方針（MVP）
- クイズ進行中は **埋め込み禁止**。各問の結果カード/最終結果のみ導線表示。
- 設定 `inlinePlayback` が **ON** のときのみ iframe 埋め込みを試行。
- **自動再生なし**。プレーヤーUIは**非改変**。
- 埋め込み不可・地域制限・失敗時は **即座に外部リンクへフォールバック**。

## フォールバック順序
1. `embedPreferredProvider` を優先して埋め込みを試行。
2. 失敗した場合は、`reveal.links` 内の **他 provider** を埋め込みで順次試行（存在する場合）。
3. いずれも不可なら **外部リンク**（anchor）を即時表示。

> 失敗の判定は、iframe 読み込み完了のイベント/タイムアウト、`postMessage` レディ信号、`blocked/by CSP` の検出など実装裁量。MVPでは**ロードタイムアウト閾値 2s** 程度を推奨。

## 失敗理由の分類（追跡用）
- `region_blocked`（地理的制限/権利）
- `provider_unavailable`（API/サービス不可）
- `embed_blocked`（X-Frame-Options/CSP 等で拒否）
- `network_error`（ネットワーク/タイムアウト）
- `unknown`（未分類）

## 追跡イベント（最小）
- `reveal_open_external`（provider, target_url）
- `embed_error`（provider, reason）
- `embed_fallback_to_link`（from_provider, to="external_link"）
- `settings_inline_toggle`（to: boolean）

## 実装ノート（ガイドライン）
- **アクセシビリティ**: 埋め込みと同階層に「新しいタブで開く」を常設。
- **パフォーマンス**: 結果カードが **初回表示されたときのみ** 埋め込みを遅延ロード。
- **セキュリティ**: iframe に `sandbox`（`allow-same-origin allow-scripts allow-popups` など最小権限）を付与。

## Provider 別メモ（MVP）
- **YouTube**: privacy-enhanced モード（`youtube-nocookie.com`）推奨。自動再生禁止。
- **Apple Music**: 埋め込みは国/アカウント要件に依存。不可時は即リンクへ。
