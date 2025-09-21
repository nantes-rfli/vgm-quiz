# 開発用モックの使い方（FE先行）
- Status: Approved
- Last Updated: 2025-09-20

このページは **フロントエンドを先に動かすための最小手順** を5分で読める範囲でまとめたものです。

## 目的
- **本物のBEが無くても** /play〜/result まで（U1〜U5）の体験を通す。
- APIの**契約（JSON Schema）**と**応答（フィクスチャ）**を明示し、後でBEを差し替えても破綻しない。

## 用語
- **フィクスチャ（fixtures）**: サーバ応答をファイル化したJSON（成功/エラー/端ケース）。
- **JSON Schema**: 応答JSONの「型の契約書」。ランタイム/CIで検証可。
- **MSWハンドラ**: ブラウザの`fetch`を横取りし、エンドポイントごとにどのフィクスチャを返すか決める関数群。

## 置き場所（現状）
```
mocks/                    # APIのモック応答（JSON）とMSWハンドラ
  api/
    rounds_start.success.json
    rounds_next.q00.json ... q09.json
    rounds_next.done.json
    errors/*.json
    metrics.accepted.json
  handlers.ts
  browser.ts
docs/api/schemas/         # JSON Schema（API契約の正本）
  rounds_start.schema.json
  rounds_next.schema.json
  metrics.schema.json
```
> FEひな形作成後は、`mocks/` を **apps/web/src/mocks/** 配下（モジュール取り込み型）へ移動予定。

## セットアップ（例: Next.js）
1. 依存を追加
   ```bash
   npm i -D msw
   ```
2. 開発時だけMSWを起動（アプリ最上位で1回）
   ```ts
   // src/app/providers.tsx
   if (process.env.NEXT_PUBLIC_API_MOCK === 1 && typeof window !== 'undefined') {
     const { worker } = await import('../../mocks/browser');
     await worker.start({ serviceWorker: { url: '/mockServiceWorker.js' } });
   }
   ```
3. フィクスチャの公開
   - 暫定: `public/mocks` に配置して `fetch('/mocks/...')` で参照
   - 最終: JSONを `import` するモジュール取り込み型に移行（外部公開しない）

## 主要エンドポイントの挙動（モック）
- `POST /v1/rounds/start` → `mocks/api/rounds_start.success.json` を返す
- `POST /v1/rounds/next`  → `mock.<idx>.<rid>` トークンを解釈して次問を返す
  - `token === 'expired'` で 401 `token_expired` をテスト可
- `POST /v1/metrics`      → 常に `202 Accepted`（部分失敗のケースは必要時に追加）

## バリデーション（任意だが推奨）
- ランタイム検証: `ajv` 等でレスポンスを `docs/api/schemas/*.json` に照合
- CI検証: `mocks/api/*.json` がスキーマに適合するかを自動チェック

## トラブルシュート
- **SWが起動しない**: `worker.start()` のURLと `public/mockServiceWorker.js` の配置を確認
- **フィクスチャが見つからない**: パス（`/mocks/...`）の先頭スラッシュに注意
- **埋め込みが読み込めない**: `docs/product/embed-policy.md` のフォールバック順に従いリンク表示へ
