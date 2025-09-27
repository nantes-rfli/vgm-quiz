# E2E Testing Plan (Playwright)

- Status: Draft
- Last Updated: 2025-09-27

## 目的
Playwright を用いた E2E テスト導入手順と運用イメージをまとめる。開発者が同じ手順で環境構築・実行・CI 連携できることを目指す。

---

## 1. ツール選定
- **Playwright** を採用。理由:
  - MSW との相性が良く、ブラウザ上の fetch を横取りしたまま動作可能。
  - Chromium / WebKit / Firefox を同一テストでカバーできる（MVP では Chromium のみを想定）。
  - `page.pause()` やトレース機能などがデバッグに便利。

---

## 2. セットアップ手順
1. 依存追加
   ```bash
   cd web
   npm install --save-dev @playwright/test
   npx playwright install
   ```
2. 基本設定
   - `playwright.config.ts` を `web/` 直下に作成。
   - `baseURL` を `http://127.0.0.1:3000` に設定。
   - CI でヘッドレス実行するため `use: { headless: true, channel: 'chrome' }` を設定。
3. スクリプト追加
   ```json
   {
     "scripts": {
       "test:e2e": "playwright test",
       "test:e2e:ui": "playwright test --ui"
     }
   }
   ```
4. 開発サーバとの連携
   - 並列実行を避けるため `npx playwright test` の前に `npm run dev` をバックグラウンドで起動する。
   - `package.json` の `test:e2e` スクリプトに `start-server-and-test` を組み合わせる案も検討。

---

## 3. CI 連携イメージ
- GitHub Actions を想定。
  1. `actions/setup-node` で Node 18＋を用意。
  2. `npm ci` → `npx playwright install --with-deps`。
  3. `npm run dev &` でサーバを起動し、`npx playwright test` を実行。
  4. 失敗時は `playwright-report/` や `test-results/` をアーティファクトとして保存。
- main ブランチ向け: smoke シナリオのみ実行。夜間ジョブやタグ付きで拡張シナリオを回す運用を検討。

---

## 4. 今後のタスク
- Playwright config テンプレートの作成。
- `start-server-and-test` 導入の検討。
- トレース／スクリーンショット保存ポリシーの策定。
- 一部シナリオを `retry: 1` として安定性を確保。

