# Phase 4B: 作曲者モード 計画メモ（Plan フェーズ）

## ゴール
- 作曲者モードを最小実装で提供し、難易度オートチューニングの A/B 検証に活用する。

## スコープ（計画時点）
- 出題条件: composer メタが存在するトラックのみを母集団にする。
- 選択肢生成: 正解1 + 誤答3（シリーズ/年代が近い作曲者を優先）。
- UI/i18n: シンプルな1行プロンプトを追加。英語/日本語対応のみで開始。
- 計測: 完走率・再訪率・正答率・問題あたり回答時間を A/B で比較。

## 非スコープ（このフェーズではやらない）
- 恒久的パーソナライズやスコア保存。
- 作曲者以外の新モード追加。
- 本格的な ML モデル導入（ルールベースで開始）。

## 依存関係 / 前提
- composer メタが取れるデータソース（Spotify 取り込み後に精度向上見込み）。
- Manifest / availability に composer が露出していること。
- A/B 割付ロジックとメトリクス集計が Phase 3 の観測基盤で確認できること。

## UI 文言（案）
- プロンプト: 「この曲の作曲者は？」
- 正解時: 「正解！作曲者: {composer}」
- 不正解時: 「正解は {composer} でした」

## i18n キー（案）
- `quiz.composer.prompt`
- `quiz.composer.correct`
- `quiz.composer.incorrect`

## A/B 設計（案）
- Treatment: composer モード + 難易度オートチューニング ON
- Control 1: composer モード + 固定難易度
- Control 2: 既存モード（難易度オートなし）
- 主要指標: 完走率 / 再訪率 / 正答率 / 回答時間
- 成功条件: 95%信頼で完走率 or 再訪率が改善し、回答時間が悪化しない。

## 指標しきい値・サンプルサイズ（ドラフト）
- 最低検出効果 (MDE): 完走率 +3pt / 再訪率 +2pt を目安に設定
- サンプルサイズ（概算）: それぞれの群で N ≈ 5k セッション（想定ベースライン完走率 35%、α=0.05, power=0.8）
- 観測期間目安: 1〜2 週間（トラフィック量次第で再計算）

## composer メタ欠損時のフォールバック案（ドラフト）
- 欠損閾値: 対象母集団で composer 欠損率が >5% なら fallback を有効にする
- フォールバック: composer 欠損トラックはモード外へ退避（抽選対象から除外）、必要に応じてタイトル/ゲーム名をもとに補完
- ロギング: 欠損率をメトリクス化し、5%超でアラート

## 実装タスク（まだ着手しない）
- [ ] i18n キー設計を確定し、言語ファイル差分を見積もる
- [ ] サンプリング条件・選択肢生成ロジックを共有ライブラリに定義（フラグで無効化のまま）
- [ ] A/B 割付のトークン埋め込み設計
- [ ] MSW/Playwright シナリオ追加のテストケース設計
- [ ] 指標しきい値とサンプルサイズの再計算（最新トラフィックに応じて）
- [ ] composer 欠損率アラートの閾値実装案を決定

## レビュー依頼事項
- プロンプト文言、指標の妥当性、Control 群の構成
- composer メタの最小品質ライン（欠損率の許容範囲）

## 実装プラン（実行用ブレークダウン）

### Milestone 0: フラグ付きスケルトンを立てる
- [x] Feature Flag `COMPOSER_MODE_ENABLED`（manifest.features.composerModeEnabled）を workers/web 両方に導入し、デフォルト OFF にする
- [x] manifest に composer モード (`vgm_composer-ja`, 仮) を追加し、/availability で露出
- [x] rounds API が mode を受け取り、存在しない場合 404 を返す動作を e2e で検証

### Milestone 1: サンプリングと選択肢生成
- [x] パイプライン publish/export で composer が存在するトラックのみを composer モード用に抽出（欠損率\>5% で warn + Slack）
- [x] 選択肢生成: 正解1 + 誤答3（シリーズ/年代近傍優先、重複作曲者が多い場合は weighted sampling）を shared レイヤーに実装（現状は均等サンプリング）
- [x] 難易度スコア初版（facetsベースの簡易マップ）を export meta に埋め込み

### Milestone 2: A/B 割付と計測
- [x] Treatment/Control の割付ロジックを token に埋め込み、比率を環境変数（AB_TREATMENT_RATIO, default 50/50）で設定可能にする
- [x] イベント拡張: quiz_start/answer_result/quiz_complete/quiz_revisit に mode/arm/時間系を送信し、E2E で検証
- [x] composer 欠損率メトリクスと 5% 超アラートを実装し、ダッシュボード接続（ログ出力 + Slack）

### Milestone 3: フロントエンド & i18n
- [x] モード選択 UI に「作曲者モード」を追加（英/日）
- [x] プロンプト/正解/不正解文言の i18n キー `quiz.composer.prompt|correct|incorrect` を追加
- [x] Adaptive 難易度で問題タイトルと Reveal 表示を composer 用に切り替える

### Milestone 4: テスト & ガードレール
- [x] MSW フィクスチャに composer モード用ラウンドを追加
- [x] Playwright シナリオ: モード選択→出題→回答→結果までを composer モードで通す
- [x] ロールバック/disable 手順を Runbook 化し、欠損率\>5% 時に無効化できることを確認（docs/ops/runbooks/composer-mode.md）

## 最初の着手ポイント（提案）
1. Milestone 0 を一括で実装し、フラグ OFF 状態でデプロイ可能にする（リスク低）
2. パイプラインの export に composer フィルタと欠損率メトリクスを追加し、ダッシュボードで可視化
3. フロントの i18n キーと UI 行追加をフラグ下で進め、MSW/Playwright の土台を用意
