# E2E Testing Plan (Playwright)

- Status: Active
- Last Updated: 2025-10-12

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

## 4. Backend API 仕様との統合 (2025-10-12 完了)

### 背景
Backend API 実装に伴い、E2E テストを新しい API レスポンス形式に対応。

### 主な変更点

#### 4.1 Reveal 構造の更新
- **変更前**: `reveal.youtubeUrl`, `reveal.spotifyUrl` などの直接プロパティ
- **変更後**: `reveal.links` 配列に `{ provider, url }` オブジェクトを格納

```typescript
// 新しい形式
reveal: {
  links: [
    { provider: 'youtube', url: 'https://...' },
    { provider: 'spotify', url: 'https://...' },
  ],
  meta: {
    trackTitle: '...',
    workTitle: '...',
    composer: '...',
  }
}
```

#### 4.2 Token 命名の統一
- MSW handlers で `continuationToken` を使用
- フロントエンドの内部状態では `token` として管理
- Token-based state management によりサーバー側セッション不要

#### 4.3 Question フォーマットの変換
- API レスポンス: `{ title, choices: [{ id, text }] }`
- 内部フォーマット: `{ prompt, choices: [{ id, label }] }`
- 変換処理は [datasource.ts](../../web/src/features/quiz/datasource.ts) で実施

#### 4.4 MSW ハンドラーの修正
[web/mocks/handlers.ts](../../web/mocks/handlers.ts) で以下を実装:
- `GET /v1/rounds/start` → `rounds.start.ok.json` を返却
- `POST /v1/rounds/next` → `continuationToken` をデコードして次の問題を返却
- 最終問題 (index 10) では `finished: true` を返却

### テスト検証
```bash
# E2E テストで全フローを検証
npm run test:e2e -- play-features.spec.ts
```

**結果**: 全テスト PASS ✅

### 関連ドキュメント
- [API Specification](../api/api-spec.md) — API 仕様
- [Frontend Play Flow](../frontend/play-flow.md) — Play ページの状態遷移

---

## 5. 今後のタスク
- トレース／スクリーンショット保存ポリシーの策定
- 一部シナリオを `retry: 1` として安定性を確保
- エラーシナリオの E2E テスト自動化 (429エラー、オフライン復帰など)

