# Phase 4A ソース候補と品質チェック方針

## ソース優先順位
1. 公式チャンネル / 公式サントラ再生リスト
2. レーベル / 権利者チャンネル（例: Square Enix Music, Sega Sound Team）
3. 高品質ファン編集の長尺サントラプレイリスト（事前サンプリングで品質確認）

## 初期候補メモ（仮）
- YouTube 公式: Nintendo 公式, CAPCOM CHANNEL, Square Enix Music (JP), Atlus Official
- レーベル系: Square Enix Music, SEGA (Sound Team), Falcom Music Channel
- 高品質プレイリスト: 「VGM Official Soundtrack」「Game OST」「BGM Collection」など、正規タイトル/トラック番号を含む長尺リストをサンプリングして選定

## 候補ID（レビュー用ドラフト）
- 公式/レーベル
  - `PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG` (Nintendo 公式 OST サンプラー) — 要確認
  - `UCLzqf8b9zj2TNd3ZKIH3p7Q` (CAPCOM CHANNEL) — 要確認
  - `UC8YcC1n-5W8nL7-h5cEaf5A` (Square Enix Music Japan) — 要確認
  - `PLZxj4JMW7UR10Zs6tDr7guPmyAnbcW2CY` (SEGA Sound Team OST) — 要確認
- プレイリスト（高品質候補）
  - `PL3jF2g1cV5yL0E-nC0BpvyEukgqS0bkkC` (VGM Official Soundtrack - curated) — 要サンプル計測
  - `PLunSvb1waVILKKrkaI0s5momkGLumZ5qX` (Game OST Collection) — 要サンプル計測
  - `PLrJz0dU5XyE_GIXXdK5vCk1vZ1tcHTULv` (JRPG Classics) — 要サンプル計測
*上記IDはドラフト。計測前に権利リスクとクォータ消費を確認し、採用可否をレビューで決定する。*

## プレイリスト選定チェック
- メタ情報: タイトルに `Game - Track` 形式または公式再生リスト名が含まれているか
- 品質: LUFS / 無音率 / クリッピング率をチェック（スクリプト雛形で実測）
- 権利性リスク: 明らかに非公式・不明なものは除外し、理由を Runbook に記載

## 品質チェック指標（スクリプトで測定予定）
- LUFS: -16 ~ -6 LUFS に収まるか（サンプル10秒）
- 無音率: 連続無音 > 2s がどれくらい発生するか
- クリッピング率: 0dBFS 付近のクリップ率
- タイトル抽出精度: 正規表現で Game/Track/Composer を抽出できる割合

### 閾値案（レビュー用ドラフト）
- LUFS: -16〜-6 LUFS
- 無音率: 連続無音2s以上が全体の1%未満
- クリップ率: 0dBFS 近傍クリップ 0.1% 未満
- タイトル抽出精度: 80%以上

## 次ステップ
- （計画フェーズ）プレイリストID/チャンネルIDを列挙し、レビュー後にサンプル計測を実施
- 計測フロー・閾値案・ロールバック手順を Issue #147 に明文化し、レビュー合意を得る
- （実行フェーズ）1プレイリストをサンプル計測 → 指標の実測値を共有 → 「採用/再検証/除外」の3分類を作成

### フェイルセーフ案（計画）
- クォータ枯渇: 翌日リトライし、並列度を1/4に縮小
- 権利/違反検知: 当該ソースを即停止し再スキャン対象へ。R2/D1 への投入は無効化し、ロールバックログを残す
