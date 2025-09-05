# DESIGN — OGP 静的生成（SVG→PNG）

最終更新: 2025-09-05

## 方針
- 外部APIに依存せず、**GitHub Actions** 内で SVG→PNG を生成して **静的配置**（Pages配信）。
- 1日1枚：`public/og/YYYY-MM-DD.png`、ショートカット：`public/og/latest.png`。
- 言語は当面 UI 既定言語（ja）を採用。将来的に `og/ja/…`, `og/en/…` パス分割も可能。

## テンプレ設計
- SVG テンプレ：`assets/og/template.svg`
- 変数差し込み：タイトル、ゲーム、作曲者、難易度（0..1）、日付
- 禁則処理：句読点ぶら下げ、長音/ダッシュの折返し抑制、max 2 行まで
- 画像要素：背景グラデ、ロゴ、難易度ゲージ（0..1を0–100%で描画）

## 生成フロー
1. `build/daily_today.json` を読み取り必要情報を抽出
2. テキスト整形（禁則・折返し）→ SVG テンプレへ差し込み
3. `resvg-js`（推奨）または `sharp` で PNG 化（1200×630）
4. 出力：`public/og/YYYY-MM-DD.png`, `public/og/latest.png`（latest は毎日差し替え）

## メタ連携
- `daily/YYYY-MM-DD.html` / `daily/latest.html`
  - `og:type=website`
  - `og:title`（日付＋トラック名）/ `og:description`（クイズ要約）
  - `og:image` → 上記PNG
  - `twitter:card=summary_large_image`

## キャッシュ戦略
- `YYYY-MM-DD.png`：immutable（長期キャッシュ/ファイル名に日付）
- `latest.png`：短期（例：3600s）＋ ETag/If-None-Match

## テスト
- ローカルで Node スクリプト単体テスト（禁則に関する短文/長文ケース）
- Actions上での生成結果をアーティファクト化して確認

## 失敗時の扱い
- 生成失敗時はビルドを fail させず、`latest.png` のみ前日のものを残す（警告ログ）
- 過去日の再生成は `workflow_dispatch` で任意実行

## 将来拡張
- 多言語 OGP（パス分割）／シリーズ別の配色テーマ
- クリップ時間の可視化（将来の Collector v1 で開始秒が決まったら描画）

## 運用メモ（PRの必須チェックが走らない場合）
`daily (ogp+feeds)` が作る PR では、**GITHUB_TOKEN ではなく PAT（例:
`${{ secrets.DAILY_PR_PAT }}`）**を使ってください。
GitHub の仕様で、GITHUB_TOKEN による PR/commit では `pull_request` トリガの Workflow が起動しない場合があり、
ブランチ保護の Required（`ci-fast-pr-build` / `pages-pr-build` / `required-check`）が永続 Pending になることがあります。
本プロジェクトでは PAT の使用を前提にしています。


## v1.8 追補 — データ参照とワークフロー
- **データ参照**：`build/daily_today.json` があれば優先。無ければ `public/app/daily_auto.json` の `by_date` 最新を使用。
- **YAML 再構成**：`.github/workflows/ogp-and-feeds.yml` は `env:` 埋め込みを避け、`Read date` は `TZ=Asia/Tokyo date +%F` を用いて安全化。
- **PNG 任意化**：`@resvg/resvg-js` は `npm i --no-save` を試行し、失敗時は **SVGのみ**生成（ジョブは成功）。
- **PR 作成**：`peter-evans/create-pull-request@v6` を使用し、**`token: ${{ secrets.DAILY_PR_PAT }}`** を必須とする。
