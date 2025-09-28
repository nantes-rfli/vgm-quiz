# VGM Quiz Monorepo

VGM Quiz はゲーム音楽クイズ体験を提供する Next.js 製フロントエンドと、Docs-as-Code で管理する仕様・運用ドキュメント群から成るモノレポです。MVP フェーズでは静的配信 + モック API を前提にフロントエンドの体験完成と品質担保を優先します。

## リポジトリ構成

- `web/` — Next.js App Router プロジェクト（React 19, TypeScript 5, Tailwind v4）。
- `docs/` — プロダクト要件, 設計, 運用メモ, 品質計画をまとめたドキュメント群。
- `docs/issues/` — GitHub Issue と同期する YAML Front Matter 付きメモ。
- `AGENTS.md` — コーディング規約と運用ルールのサマリ。

## 開発セットアップ

1. Node.js 20 以上を用意します（Volta などのバージョン固定ツール推奨）。
2. 初回のみ `web/` ディレクトリで依存関係をインストールします。
   ```bash
   cd web
   npm install
   ```
3. MSW が自動的に起動します。追加のバックエンドは不要です。

## よく使うコマンド（web/ 配下）

| コマンド | 用途 |
| --- | --- |
| `npm run dev` | 開発サーバーを起動 (http://localhost:3000)。 |
| `npm run build && npm run start` | 本番ビルドの検証。 |
| `npm run lint` | ESLint ルールチェック。 |
| `npm run typecheck` | TypeScript 型チェック (noEmit)。 |
| `npm run validate:fixtures` | JSON Schema に対するフィクスチャ検証。 |
| `npm run test:e2e` | Playwright E2E テスト（Chromium）。 |
| `npm run test:e2e -- --project=chromium --ui` | UI モードでのデバッグ実行。 |

> Playwright を初めて利用する場合は `npx playwright install` を実行してください。

## ドキュメントの読み方

- プロダクト要件: `docs/product/requirements.md`
- API 仕様: `docs/api/api-spec.md`
- データモデル: `docs/data/model.md`
- フロントエンドガイド: `docs/frontend/README.md`
- 品質/テスト計画: `docs/quality/e2e-plan.md`

Docs は常に PR と一緒に更新する運用です。Issue 番号付きドキュメントは `docs/issues/<number>-*.md` を参照してください。

## 作業フロー

1. Issue を確認し、関連ドキュメントを読みます。
2. 作業ブランチを切り、コード/ドキュメントを変更します。
3. `npm run lint` `npm run typecheck` `npm run test:e2e` など必要なチェックを実行します。
4. 変更内容・テスト結果・関連ドキュメントを PR 説明に記載します。
5. ドメインリードのレビューを経てマージします。

## テストと計測

- MSW フィクスチャで `/v1/rounds/*` と `/v1/metrics` をスタブしています。実 BE 接続時は `NEXT_PUBLIC_API_MOCK=0` を設定します。
- 計測イベントは `web/src/lib/metrics/metricsClient.ts` に実装済み。再送挙動やイベント語彙は `docs/frontend/metrics-client.md` を参照してください。

## ライセンス

MIT License (see `LICENSE`).
