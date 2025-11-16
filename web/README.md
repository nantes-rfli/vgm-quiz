# Web App (Next.js)

VGM Quiz のフロントエンドは Next.js App Router を採用し、MSW でモック API を提供しています。ここでは開発者向けのセットアップと運用手順をまとめます。

## 前提条件

- Node.js 20 以上
- npm 10 以上（`npm` 同梱推奨）
- Playwright を利用する場合は `npx playwright install` が必要

## セットアップ

```bash
npm install
```

開発サーバー起動時に MSW の Service Worker が自動登録されます。`NEXT_PUBLIC_API_MOCK=0` を指定すると実 API 接続前提モードへ切り替えられます。

## スクリプト

| コマンド | 説明 |
| --- | --- |
| `npm run dev` | 開発サーバーを起動 (http://localhost:3000)。ホットリロード対応。 |
| `npm run build` | 本番ビルドを生成。`npm run start` と組み合わせて検証。 |
| `npm run lint` | ESLint による静的解析。ルートの `eslint.config.mjs` を参照。 |
| `npm run typecheck` | TypeScript 型チェック (`tsc --noEmit`)。 |
| `npm run validate:fixtures` | `docs/api/schemas` とフィクスチャの整合を Ajv で検証。 |
| `npm run test:e2e` | Playwright E2E (Chromium)。CI でも使用。 |
| `npm run test:e2e:ui` | Playwright UI モード。ローカルデバッグ用。 |
| `npm run test:unit` | Vitest ユニット/契約テスト（`metricsClient`/`reveal` など）。 |

## ディレクトリ構成

- `app/` — App Router エントリ。`/play`, `/result` などの画面を提供。
- `components/` — 再利用コンポーネントとデザインシステム部品。
- `src/features/` — ドメイン別ロジック。`quiz/` に API 型定義とデータソース。
- `src/lib/` — メトリクス、ストレージ、HTTP ユーティリティ。
- `mocks/` — MSW のハンドラとフィクスチャ。E2E でも利用。
- `tests/e2e/` — Playwright のシナリオ。

## 環境変数

| 変数 | 用途 | 既定値 |
| --- | --- | --- |
| `NEXT_PUBLIC_API_MOCK` | `1` のとき MSW を利用。`0` で実 API にスイッチ。 | `1` |
| `NEXT_PUBLIC_PLAY_AUTOSTART` | `/play` の自動スタート制御。`0` で手動開始。 | `1` |
| `NEXT_PUBLIC_APP_VERSION` | メトリクス送信時のバージョンタグ。設定が無い場合 `package.json` の version。 | 省略可 |

`.env.local` を作成し、必要に応じて上記値を上書きしてください。

## 開発の流れ

1. ブランチを切る（Issue 番号がある場合は含める）。
2. コード/スタイル/ドキュメントを更新。Tailwind v4 + class-variance-authority を使用。
3. `npm run lint` と `npm run typecheck` を実行。
4. UI 変更時はスクリーンショットや録画を PR に添付。
5. E2E が必要な場合は `npm run test:e2e` を実行し、`test-results/` を確認。

## テスト戦略

- スモーク: `tests/e2e/play-smoke.spec.ts`
- 詳細検証: `tests/e2e/play-features.spec.ts`
- 契約テスト: `npm run test:unit -- tests/unit/metricsClient.contract.spec.ts` と `tests/unit/reveal.contract.spec.ts` をピンポイントで実行し、メトリクス/Reveal payload の破壊的変更を検出します。
- MSW フィクスチャは `mocks/fixtures` 内で一元管理し、`npm run validate:fixtures` でスキーマ整合を保証します。

## リンク集

- プロダクト要件: `../docs/product/requirements.md`
- プレイフロー設計: `../docs/frontend/play-flow.md`
- メトリクスクライアント: `../docs/frontend/metrics-client.md`
- Embed ポリシー: `../docs/product/embed-policy.md`

更新時は関連ドキュメントの参照を忘れずに。Docs-as-Code の原則に従い、コード変更と同じ PR でドキュメントを更新してください。
