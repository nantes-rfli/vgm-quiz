# Frontend-Backend Integration Guide

- **Status**: Draft
- **Last Updated**: 2025-10-11
- **Target**: Phase 1 Backend Integration

## 1. Overview

このドキュメントは、Phase 1 バックエンド (Cloudflare Workers) とフロントエンド (Next.js) の統合手順をまとめます。

### 統合の目的

- MSW モックから実バックエンド API への移行
- ローカル開発環境での Workers 接続
- 本番環境への Cloudflare Pages デプロイ

### 前提条件

- ✅ Phase 1 バックエンド実装完了 (`/daily`, `/v1/rounds/*` エンドポイント)
- ⚠️ フロントエンドは MSW 経由で理想仕様を想定しているため、実装との差分を吸収する必要がある

### 仕様の二層化について

現在、API仕様には **Phase 1 (簡易実装)** と **Phase 2 (理想仕様)** の2つが存在します:

- **Phase 1 実装** ([workers/api/src/routes/rounds.ts](../../workers/api/src/routes/rounds.ts)) — 現在動作している実装
  - `GET /v1/rounds/start` (パラメータなし)
  - Base64 トークン (署名なし)
  - シンプルな正誤判定

- **Phase 2 理想仕様** ([docs/api/api-spec.md](../api/api-spec.md)) — 将来の拡張版
  - `POST /v1/rounds/start` (フィルタ・モード指定)
  - JWS 署名付きトークン
  - スコア計算・elapsedMs 対応

**本ドキュメントは Phase 1 実装を正として記述します**。Phase 2 への移行計画は [9. Phase 2 Migration Roadmap](#9-phase-2-migration-roadmap) を参照してください。

## 2. Architecture

### 現状 (MSW)

```
Next.js (localhost:3000)
  ↓
MSW (Mock Service Worker)
  ↓
Fixtures (web/mocks/fixtures/rounds/)
```

### 統合後 (Workers)

```
Next.js (localhost:3000 or Cloudflare Pages)
  ↓
API Worker (localhost:8787 or vgm-quiz-api.nantos.workers.dev)
  ↓
D1 Database + R2 Storage
```

## 3. Phase 1 API Specification (Current Implementation)

**実装箇所**: [workers/api/src/routes/rounds.ts](../../workers/api/src/routes/rounds.ts)

Phase 1 では以下の仕様で `/v1/rounds/*` が実装されています。

### 3.1 `GET /v1/rounds/start`

**目的**: クイズラウンドを開始し、最初の問題とトークンを返す

**リクエスト**:
```http
GET /v1/rounds/start
```

パラメータなし（今日の日付の問題セットを自動取得）

**レスポンス**:
```json
{
  "question": {
    "id": "q_0001",
    "title": "この曲のゲームタイトルは?"
  },
  "choices": [
    { "id": "a", "text": "Final Fantasy VI" },
    { "id": "b", "text": "Chrono Trigger" },
    { "id": "c", "text": "Secret of Mana" },
    { "id": "d", "text": "Super Mario World" }
  ],
  "continuationToken": "eyJkYXRlIjoiMjAyNS0xMC0xMSIsImN1cnJlbnRJbmRleCI6MCwidG90YWxRdWVzdGlvbnMiOjEwfQ=="
}
```

**実装詳細**:
- 今日の日付 (JST) の R2 Export から問題セットを取得
- Base64 エンコードされた `continuationToken` を生成
  - `{ date, currentIndex, totalQuestions }` を JSON → Base64
- `choices` に `correct` フィールドは**含まない** (セキュリティ)

### 3.2 `POST /v1/rounds/next`

**目的**: 回答を受け取り、正誤判定と次の問題を返す

**リクエスト**:
```json
{
  "continuationToken": "eyJ...",
  "answer": "b"
}
```

**レスポンス**:
```json
{
  "result": {
    "correct": true,
    "correctAnswer": "b",
    "reveal": {
      "title": "Terra's Theme",
      "game": "Final Fantasy VI",
      "composer": "Nobuo Uematsu",
      "year": 1994,
      "platform": "Super Famicom",
      "series": "Final Fantasy",
      "youtube_url": "https://www.youtube.com/watch?v=...",
      "spotify_url": "https://open.spotify.com/track/..."
    }
  },
  "question": {
    "id": "q_0002",
    "title": "この曲のゲームタイトルは?"
  },
  "choices": [
    { "id": "a", "text": "..." },
    { "id": "b", "text": "..." },
    { "id": "c", "text": "..." },
    { "id": "d", "text": "..." }
  ],
  "continuationToken": "eyJ...",
  "finished": false
}
```

最終問題の場合:
```json
{
  "result": { /* 同上 */ },
  "finished": true
}
```

**実装詳細**:
- `continuationToken` をデコード (Base64 → JSON)
- `answer` と正解の `choice.id` を照合
- `result.reveal` に楽曲メタデータを含める
- 次の問題が存在する場合は `question`, `choices`, `continuationToken` を返す
- 最終問題の場合は `finished: true`, `question` を省略

### 3.3 Token Payload Structure (Phase 1)

```typescript
interface TokenPayload {
  date: string           // "2025-10-11" (JST)
  currentIndex: number   // 0-based index
  totalQuestions: number // 10
}
```

**エンコード方式**: Base64 (署名なし)
- Phase 1 では簡易実装（改ざん検知なし）
- Phase 2 で JWS 署名を追加予定

**実装箇所**: [workers/api/src/lib/token.ts](../../workers/api/src/lib/token.ts)

### 3.4 Error Responses

```json
{
  "error": "Invalid token",
  "message": "Continuation token is invalid or expired"
}
```

**Status Codes**:
- `400` — リクエストボディが不正、トークンが無効
- `404` — 問題セットが見つからない
- `500` — サーバー内部エラー
- `503` — 問題セットが利用不可

### 3.5 Phase 1 vs Phase 2 Comparison

| 項目 | Phase 1 (現行) | Phase 2 (理想) |
|------|----------------|----------------|
| **Start エンドポイント** | `GET /v1/rounds/start` | `POST /v1/rounds/start` |
| **Start パラメータ** | なし | `{ mode, filters, total, seed }` |
| **トークン形式** | Base64 (署名なし) | JWS (HMAC-SHA256) |
| **Next リクエスト** | `{ continuationToken, answer }` | `{ token, answer: { questionId, choiceId, elapsedMs } }` |
| **スコア計算** | なし (FE で計算) | BE で計算して返却 |
| **Progress 情報** | トークン内のみ | レスポンスに明示 |

Phase 2 への移行計画は [9. Phase 2 Migration Roadmap](#9-phase-2-migration-roadmap) を参照。

## 4. Frontend Modifications

### 4.1 環境変数

#### ローカル開発 (`.env.local`)

```bash
# MSW を無効化
NEXT_PUBLIC_API_MOCK=0

# Workers ローカル接続
NEXT_PUBLIC_API_BASE_URL=http://localhost:8787
```

#### 本番環境 (Cloudflare Pages 環境変数)

```bash
NEXT_PUBLIC_API_MOCK=0
NEXT_PUBLIC_API_BASE_URL=https://vgm-quiz-api.nantos.workers.dev
```

### 4.2 API クライアント修正

**対象ファイル**: [web/src/features/quiz/datasource.ts](../../web/src/features/quiz/datasource.ts)

#### 現状 (MSW 経由で Phase 2 仕様を想定)

```typescript
export async function start(): Promise<RoundsStartResponse> {
  const res = await fetch('/v1/rounds/start', { method: 'POST' });
  if (!res.ok) throw new Error(`start failed: ${res.status}`);
  return json<RoundsStartResponse>(res);
}

export async function next(payload: {
  token: string;
  answer: { questionId: string; choiceId: string }
}): Promise<RoundsNextResponse> {
  const res = await fetch('/v1/rounds/next', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`next failed: ${res.status}`);
  return json<RoundsNextResponse>(res);
}
```

#### 修正案 (Phase 1 実装に合わせる)

**ステップ1: 型定義を Phase 1 用に更新 (先に実施)**

まず [4.3 型定義の調整](#43-型定義の調整) を参照して、Phase 1 用の型を追加してください。

**ステップ2: datasource.ts を修正**

```typescript
import type { Phase1StartResponse, Phase1NextResponse } from './api/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || '';
const IS_MOCK = process.env.NEXT_PUBLIC_API_MOCK !== '0';

export async function start(): Promise<Phase1StartResponse> {
  const url = IS_MOCK ? '/v1/rounds/start' : `${API_BASE_URL}/v1/rounds/start`;
  const res = await fetch(url, { method: 'GET' }); // POST → GET
  if (!res.ok) throw new Error(`start failed: ${res.status}`);
  return json<Phase1StartResponse>(res);
}

export async function next(payload: {
  continuationToken: string;  // token → continuationToken
  answer: string              // { questionId, choiceId } → string
}): Promise<Phase1NextResponse> {
  const url = IS_MOCK ? '/v1/rounds/next' : `${API_BASE_URL}/v1/rounds/next`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`next failed: ${res.status}`);
  return json<Phase1NextResponse>(res);
}
```

**変更点**:
1. 戻り値の型を `Phase1StartResponse` / `Phase1NextResponse` に変更 ⭐
2. `/v1/rounds/start` を `POST` → `GET` に変更
3. `next()` の引数を Phase 1 形式に変更
   - `token` → `continuationToken`
   - `answer: { questionId, choiceId }` → `answer: string`
4. 環境変数による API_BASE_URL の切り替え

**既存コードへの影響**:
- `start()` / `next()` を呼び出している箇所 (playReducer など) も型を調整する必要があります
- または、既存の `RoundsStartResponse` / `RoundsNextResponse` 自体を Phase 1 仕様に更新する方法もあります (下記の「代替案」参照)

### 4.3 型定義の調整

**対象ファイル**: [web/src/features/quiz/api/types.ts](../../web/src/features/quiz/api/types.ts)

#### アプローチ A: Phase 1 用の新しい型を追加 (推奨)

Phase 2 への移行を見据え、Phase 1 専用の型を追加します。

```typescript
// Phase 1 API Types
export interface Phase1Question {
  id: string;
  title: string;
}

export interface Phase1Choice {
  id: string;
  text: string;
}

export interface Phase1Reveal {
  title: string;
  game: string;
  composer?: string;
  year?: number;
  platform?: string;
  series?: string;
  youtube_url?: string;
  spotify_url?: string;
}

export interface Phase1StartResponse {
  question: Phase1Question;
  choices: Phase1Choice[];
  continuationToken: string;
}

export interface Phase1NextResponse {
  result: {
    correct: boolean;
    correctAnswer: string;
    reveal: Phase1Reveal;
  };
  question?: Phase1Question;
  choices?: Phase1Choice[];
  continuationToken?: string;
  finished: boolean;
}

// Phase 2 向けの既存型は維持 (将来の移行用)
export interface RoundsStartResponse { /* 既存 */ }
export interface RoundsNextResponse { /* 既存 */ }
```

**この場合の追加作業**:
1. `datasource.ts` の戻り値を `Phase1StartResponse` / `Phase1NextResponse` に変更
2. `datasource.ts` を呼び出している箇所 (playReducer, useAnswerProcessor など) も Phase 1 型に対応
3. MSW ハンドラーも Phase 1 型を返すように修正

#### アプローチ B: 既存型を Phase 1 仕様に上書き (シンプル)

既存の `RoundsStartResponse` / `RoundsNextResponse` を Phase 1 仕様に書き換えます。

```typescript
// Phase 1 仕様 (Phase 2 移行時に拡張予定)
export interface RoundsStartResponse {
  question: {
    id: string;
    title: string;
  };
  choices: {
    id: string;
    text: string;
  }[];
  continuationToken: string;  // Phase 2: token に変更予定
}

export interface RoundsNextResponse {
  result: {
    correct: boolean;
    correctAnswer: string;
    reveal: {
      title: string;
      game: string;
      composer?: string;
      year?: number;
      platform?: string;
      series?: string;
      youtube_url?: string;
      spotify_url?: string;
    };
  };
  question?: {
    id: string;
    title: string;
  };
  choices?: {
    id: string;
    text: string;
  }[];
  continuationToken?: string;  // Phase 2: token に変更予定
  finished: boolean;
}
```

**この場合の追加作業**:
1. `datasource.ts` は型変更不要（既存の型定義を使い続ける）
2. 呼び出し側も影響なし（型の中身が変わっただけ）
3. Phase 2 移行時に `continuationToken` → `token` などフィールド名を変更

**推奨**: **アプローチ A** (Phase 1/2 を明示的に分離、移行時に混乱が少ない)

### 4.4 MSW ハンドラーの修正

**対象ファイル**: [web/mocks/handlers.ts](../../web/mocks/handlers.ts)

Phase 1 実装に合わせて MSW のレスポンスを修正します。

#### 重要: Node 環境対応の Base64 エンコード

**⚠️ `btoa` / `atob` は Node 環境で未定義のため、Playwright や SSR で実行すると失敗します。**

既存の `handlers.ts` には環境非依存のヘルパーが用意されているので、これを使用してください:

```typescript
// web/mocks/handlers.ts の既存ヘルパー (lines 11-44)
function b64uEncodeString(str: string): string {
  try {
    // Browser path
    const b64 = typeof btoa !== 'undefined'
      ? btoa(unescape(encodeURIComponent(str)))
      : Buffer.from(str, 'utf8').toString('base64');
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  } catch {
    // Fallback to Buffer if available
    const anyBuf: any = (globalThis as any).Buffer;
    const b64 = anyBuf ? anyBuf.from(str, 'utf8').toString('base64') : str;
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }
}

function b64uDecodeToString(b64u: string): string {
  const b64 = b64u.replace(/-/g, '+').replace(/_/g, '/');
  try {
    // Browser path
    const s = typeof atob !== 'undefined' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
    return decodeURIComponent(escape(s));
  } catch {
    // Fallback to Buffer UTF-8
    const anyBuf: any = (globalThis as any).Buffer;
    return anyBuf ? anyBuf.from(b64, 'base64').toString('utf8') : b64u;
  }
}

const enc = (obj: unknown) => b64uEncodeString(JSON.stringify(obj));
const dec = (b64u: string): unknown => JSON.parse(b64uDecodeToString(b64u));
```

#### Phase 1 用のハンドラー実装

```typescript
// GET /v1/rounds/start (Phase 1)
http.get('/v1/rounds/start', () => {
  return HttpResponse.json({
    question: { id: 'q_001', title: 'この曲のゲームタイトルは?' },
    choices: [
      { id: 'a', text: 'Final Fantasy VI' },
      { id: 'b', text: 'Chrono Trigger' },
      { id: 'c', text: 'Secret of Mana' },
      { id: 'd', text: 'Super Mario World' }
    ],
    continuationToken: enc({  // ✅ enc() を使用 (btoa ではない)
      date: '2025-10-11',
      currentIndex: 0,
      totalQuestions: 10
    })
  });
}),

// POST /v1/rounds/next (Phase 1)
http.post('/v1/rounds/next', async ({ request }) => {
  const { continuationToken, answer } = await request.json();
  const token = dec(continuationToken) as {  // ✅ dec() を使用 (atob ではない)
    date: string;
    currentIndex: number;
    totalQuestions: number;
  };

  // 正誤判定 (モックデータから)
  const correct = answer === 'a'; // 例: ANSWERS から取得

  const nextIndex = token.currentIndex + 1;
  const finished = nextIndex >= token.totalQuestions;

  return HttpResponse.json({
    result: {
      correct,
      correctAnswer: 'a',
      reveal: {
        title: "Terra's Theme",
        game: "Final Fantasy VI",
        composer: "Nobuo Uematsu",
        year: 1994,
        platform: "Super Famicom",
        series: "Final Fantasy",
        youtube_url: "https://www.youtube.com/watch?v=...",
        spotify_url: "https://open.spotify.com/track/..."
      }
    },
    question: finished ? undefined : { id: `q_00${nextIndex + 1}`, title: '...' },
    choices: finished ? undefined : [
      { id: 'a', text: '...' },
      { id: 'b', text: '...' },
      { id: 'c', text: '...' },
      { id: 'd', text: '...' }
    ],
    continuationToken: finished ? undefined : enc({  // ✅ enc() を使用
      date: token.date,
      currentIndex: nextIndex,
      totalQuestions: token.totalQuestions
    }),
    finished
  });
}),
```

**変更点**:
1. ✅ `btoa()` → `enc()` (環境非依存のヘルパー)
2. ✅ `atob()` → `dec()` (環境非依存のヘルパー)
3. ✅ Node 環境 (Playwright, SSR) でも動作する

### 4.5 エラーハンドリング

**方針**: ユーザーにエラーメッセージを表示し、再試行を促す

#### 実装箇所

エラーハンドリングは `datasource.ts` 内で行うのではなく、呼び出し側 (playReducer, useAnswerProcessor など) で `try-catch` を使用します。

#### パターン 1: ネットワークエラー (fetch 失敗)

```typescript
// playReducer.ts や useAnswerProcessor.ts などで
try {
  const response = await start() // start() は Phase1StartResponse を返す
  // 正常系の処理
  dispatch({ type: 'STARTED', payload: response })
} catch (error) {
  // fetch 失敗、または response.ok === false の場合
  dispatch({
    type: 'ERROR',
    payload: {
      message: '接続できません。インターネット接続を確認してください',
      retry: true
    }
  })
}
```

#### パターン 2: サーバーエラー検知

`datasource.ts` で status code をチェックし、詳細なエラーを投げる:

```typescript
// datasource.ts 内
export async function start(): Promise<Phase1StartResponse> {
  const url = IS_MOCK ? '/v1/rounds/start' : `${API_BASE_URL}/v1/rounds/start`;
  const res = await fetch(url, { method: 'GET' });

  if (!res.ok) {
    if (res.status >= 500) {
      throw new Error('SERVER_ERROR')
    } else if (res.status === 503) {
      throw new Error('SERVICE_UNAVAILABLE')
    } else {
      throw new Error(`HTTP_${res.status}`)
    }
  }

  return json<Phase1StartResponse>(res);
}

// 呼び出し側
try {
  const response = await start()
  // ...
} catch (error) {
  const message = error instanceof Error ? error.message : 'UNKNOWN_ERROR'
  let userMessage = '接続できません'

  if (message === 'SERVER_ERROR') {
    userMessage = '一時的な問題が発生しています。しばらくしてからお試しください'
  } else if (message === 'SERVICE_UNAVAILABLE') {
    userMessage = '問題セットが利用できません。時間をおいて再度お試しください'
  }

  dispatch({ type: 'ERROR', payload: { message: userMessage, retry: true } })
}
```

#### パターン 3: トークンエラー (next() でのみ発生)

```typescript
try {
  const response = await next({ continuationToken, answer: 'a' })
  // 正常系
  dispatch({ type: 'NEXT_QUESTION', payload: response })
} catch (error) {
  const message = error instanceof Error ? error.message : ''

  // トークン無効の場合（BE が 400 を返す）
  if (message.includes('400') || message.includes('Invalid token')) {
    dispatch({
      type: 'ERROR',
      payload: {
        message: 'セッションが期限切れです。再度開始してください',
        restart: true
      }
    })
  } else {
    dispatch({
      type: 'ERROR',
      payload: { message: '接続できません', retry: true }
    })
  }
}
```

#### 推奨パターン

エラー型を定義して構造化する:

```typescript
// datasource.ts
export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export async function start(): Promise<Phase1StartResponse> {
  const url = IS_MOCK ? '/v1/rounds/start' : `${API_BASE_URL}/v1/rounds/start`;
  const res = await fetch(url, { method: 'GET' });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new ApiError(
      data.message || `HTTP ${res.status}`,
      res.status,
      data.error
    )
  }

  return json<Phase1StartResponse>(res);
}

// 呼び出し側
try {
  const response = await start()
  // ...
} catch (error) {
  if (error instanceof ApiError) {
    if (error.status && error.status >= 500) {
      showError('一時的な問題が発生しています')
    } else if (error.code === 'Invalid token') {
      showError('セッションが期限切れです', { restart: true })
    } else {
      showError('接続できません')
    }
  } else {
    showError('ネットワークエラーが発生しました')
  }
}
```

## 5. Local Development Workflow

### 5.1 セットアップ

```bash
# 1. Backend (Workers) を起動
cd workers
npm run dev:api
# → http://localhost:8787 で起動

# 2. Frontend (Next.js) を起動 (別ターミナル)
cd web
echo "NEXT_PUBLIC_API_MOCK=0" > .env.local
echo "NEXT_PUBLIC_API_BASE_URL=http://localhost:8787" >> .env.local
npm run dev
# → http://localhost:3000 で起動
```

### 5.2 初回データセットアップ

```bash
# Pipeline Worker を起動 (別ターミナル)
cd workers
npm run dev:pipeline
# → http://localhost:8788 で起動

# Discovery 実行 (curated.json → D1)
curl -X POST http://localhost:8788/trigger/discovery

# Publish 実行 (D1 → R2 Export)
curl -X POST "http://localhost:8788/trigger/publish?date=$(date +%Y-%m-%d)"
```

### 5.3 動作確認

1. ブラウザで http://localhost:3000 を開く
2. `/play` に遷移してクイズを開始
3. DevTools Network タブで `http://localhost:8787/v1/rounds/start` が呼ばれることを確認
4. 問題が表示されることを確認
5. 回答後に `/v1/rounds/next` が呼ばれることを確認

## 6. Cloudflare Pages Deployment

### 6.1 Pages プロジェクト作成

```bash
# Cloudflare ダッシュボードで実施
# 1. Workers & Pages → Create application → Pages → Connect to Git
# 2. GitHub リポジトリ (vgm-quiz) を選択
# 3. Build settings:
#    - Framework preset: Next.js
#    - Build command: cd web && npm run build
#    - Build output directory: web/.next
#    - Root directory: / (デフォルト)
```

または CLI で:

```bash
# wrangler で Pages プロジェクト作成
wrangler pages project create vgm-quiz --production-branch=main

# GitHub Actions での自動デプロイ設定は別途
```

### 6.2 環境変数設定

Cloudflare Pages ダッシュボードで設定:

| Variable | Value | Environment |
|----------|-------|-------------|
| `NEXT_PUBLIC_API_MOCK` | `0` | Production |
| `NEXT_PUBLIC_API_BASE_URL` | `https://vgm-quiz-api.nantos.workers.dev` | Production |

### 6.3 ビルド設定

#### `web/package.json` (確認)

```json
{
  "scripts": {
    "build": "next build",
    "start": "next start"
  }
}
```

#### Next.js の静的エクスポート設定 (該当する場合)

現在 Next.js App Router を使用しており、CSR 中心の設計です。Cloudflare Pages は Next.js をサポートしていますが、一部機能に制限があります。

**推奨**: `@cloudflare/next-on-pages` を使用

```bash
cd web
npm install -D @cloudflare/next-on-pages
```

`web/package.json`:
```json
{
  "scripts": {
    "pages:build": "npx @cloudflare/next-on-pages",
    "pages:dev": "npx @cloudflare/next-on-pages --watch"
  }
}
```

Cloudflare Pages のビルドコマンドを `npm run pages:build` に変更。

詳細: https://developers.cloudflare.com/pages/framework-guides/nextjs/

### 6.4 CORS 設定 (Workers 側)

#### `workers/api/src/index.ts`

```typescript
function setCorsHeaders(response: Response): Response {
  const headers = new Headers(response.headers)
  headers.set('Access-Control-Allow-Origin', 'https://vgm-quiz.pages.dev') // Pages URL
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  headers.set('Access-Control-Allow-Headers', 'Content-Type')
  headers.set('Access-Control-Max-Age', '86400')
  return new Response(response.body, { ...response, headers })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // OPTIONS リクエスト (プリフライト)
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': 'https://vgm-quiz.pages.dev',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400'
        }
      })
    }

    // 通常のリクエスト処理
    const response = await handleRequest(request, env)
    return setCorsHeaders(response)
  }
}
```

ローカル開発時は `localhost:3000` も許可:

```typescript
const allowedOrigins = [
  'https://vgm-quiz.pages.dev',
  'http://localhost:3000'
]

function setCorsHeaders(response: Response, origin: string): Response {
  const headers = new Headers(response.headers)
  if (allowedOrigins.includes(origin)) {
    headers.set('Access-Control-Allow-Origin', origin)
  }
  // ...
}
```

## 7. Testing Checklist

### 7.1 ローカル統合テスト

- [ ] Workers API が起動できる (`npm run dev:api`)
- [ ] Next.js が Workers に接続できる (`NEXT_PUBLIC_API_MOCK=0`)
- [ ] `/v1/rounds/start` が正常にレスポンスを返す
- [ ] `/v1/rounds/next` で次の問題が取得できる
- [ ] 10問完走できる
- [ ] 正誤判定が正しい
- [ ] スコア計算が正しい
- [ ] reveal メタデータが表示される

### 7.2 E2E テスト (実 API)

```bash
cd web
NEXT_PUBLIC_API_MOCK=0 NEXT_PUBLIC_API_BASE_URL=http://localhost:8787 npm run test:e2e
```

- [ ] E2E テストが全てパスする
- [ ] タイムアウト処理が動作する
- [ ] エラーハンドリングが動作する

### 7.3 本番デプロイ前チェック

- [ ] Workers API が本番デプロイされている
- [ ] Pages 環境変数が設定されている
- [ ] CORS 設定が正しい
- [ ] R2 に最新の Export が存在する
- [ ] ステージング環境で動作確認 (可能であれば)

## 8. Troubleshooting

### 問題: CORS エラーが発生する

**症状**:
```
Access to fetch at 'http://localhost:8787/v1/rounds/start' from origin 'http://localhost:3000'
has been blocked by CORS policy
```

**解決策**:
1. Workers の CORS ヘッダー設定を確認
2. `OPTIONS` リクエストのハンドリングを実装
3. `Access-Control-Allow-Origin` に正しいオリジンを設定

### 問題: トークンが無効になる

**症状**:
```json
{ "error": { "code": "unauthorized_token" } }
```

**原因**:
- トークン有効期限切れ (デフォルト 1時間)
- JWT シークレットキーの不一致
- トークンの改ざん

**解決策**:
1. 有効期限を確認 (長時間テスト時は延長)
2. `JWT_SECRET` 環境変数が Workers に設定されているか確認
3. トークンの署名アルゴリズムが一致しているか確認

### 問題: 問題が表示されない

**症状**:
- `/v1/rounds/start` は成功するが、`question` が空

**原因**:
- R2 に Export が存在しない
- D1 に楽曲データが登録されていない

**解決策**:
```bash
# Discovery → Publish を再実行
curl -X POST http://localhost:8788/trigger/discovery
curl -X POST "http://localhost:8788/trigger/publish?date=$(date +%Y-%m-%d)"

# R2 の確認
wrangler r2 object get vgm-quiz-storage/exports/$(date +%Y-%m-%d).json
```

### 問題: スコアが正しく計算されない

**症状**:
- 正解でもスコアが 0
- スコアが異常に高い

**原因**:
- `elapsedMs` の単位間違い (ms vs sec)
- スコア計算式のバグ

**解決策**:
1. フロントエンドが `elapsedMs` をミリ秒で送信しているか確認
2. バックエンドのスコア計算式を確認: `100 + Math.max(0, Math.floor((15000 - elapsedMs) / 1000)) * 5`
3. 上限 175点、下限 0点になることを確認

### 問題: Cloudflare Pages ビルドが失敗する

**症状**:
```
Error: Command failed with exit code 1: npm run build
```

**原因**:
- `web/` ディレクトリでのビルドコマンド実行
- 依存関係の不足
- TypeScript エラー

**解決策**:
1. Build command を `cd web && npm install && npm run build` に変更
2. ローカルで `npm run build` が成功することを確認
3. `npm run typecheck` でエラーがないか確認

## 9. Phase 2 Migration Roadmap

Phase 1 (現行実装) から Phase 2 (理想仕様) への移行計画です。

### 9.1 Phase 2 の主な変更点

| カテゴリ | 変更内容 | 優先度 |
|----------|---------|--------|
| **トークン** | Base64 → JWS 署名 (HMAC-SHA256) | 高 |
| **Start エンドポイント** | `GET` → `POST` に変更 | 中 |
| **Start パラメータ** | `mode`, `filters`, `total`, `seed` を追加 | 中 |
| **Next リクエスト** | `answer: string` → `answer: { questionId, choiceId, elapsedMs }` | 高 |
| **スコア計算** | FE → BE に移行 | 高 |
| **Progress 情報** | レスポンスに `round.progress` を明示 | 低 |

### 9.2 移行ステップ

#### Step 1: トークンの JWS 化 (高優先度)

**目的**: 改ざん検知・セキュリティ強化

**変更箇所**:
- `workers/api/src/lib/token.ts` — JWS 署名・検証ロジック追加
- `workers/api/wrangler.toml` — 環境変数 `JWT_SECRET` 追加

**実装方針**:
```typescript
import { SignJWT, jwtVerify } from 'jose'

export async function createContinuationToken(payload: TokenPayload, secret: string): Promise<string> {
  const jwt = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(secret))
  return jwt
}

export async function decodeContinuationToken(token: string, secret: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret))
    return payload as TokenPayload
  } catch {
    return null
  }
}
```

#### Step 2: スコア計算の BE 移行 (高優先度)

**目的**: 不正なスコア送信を防止

**変更箇所**:
- `workers/api/src/routes/rounds.ts` — `handleRoundsNext()` にスコア計算ロジック追加
- `web/src/features/quiz/datasource.ts` — `next()` に `elapsedMs` を追加

**実装方針**:
```typescript
// Backend
const elapsedMs = payload.answer.elapsedMs
const remainingSec = Math.max(0, Math.floor((15000 - elapsedMs) / 1000))
const score = isCorrect ? 100 + remainingSec * 5 : 0

response.result.score = score

// Frontend
await next({
  continuationToken,
  answer: {
    questionId: currentQuestion.id,
    choiceId: selectedChoice.id,
    elapsedMs: Date.now() - questionStartTime
  }
})
```

#### Step 3: Start エンドポイントの POST 化 (中優先度)

**目的**: フィルタ・モード指定に対応

**変更箇所**:
- `workers/api/src/index.ts` — ルーティングを `POST` に変更
- `workers/api/src/routes/rounds.ts` — リクエストボディからパラメータ取得
- `web/src/features/quiz/datasource.ts` — `start()` を `POST` に変更

**実装方針**:
```typescript
// Backend
export async function handleRoundsStart(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as { mode?: string; filters?: object; total?: number; seed?: string }
  const { mode = 'vgm_v1-ja', total = 10 } = body

  // フィルタに基づいて問題セットを選定
  // Phase 1 では filters は無視
  // ...
}

// Frontend
export async function start(options?: { mode?: string; total?: number }) {
  const res = await fetch(`${API_BASE_URL}/v1/rounds/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'vgm_v1-ja', total: 10, ...options })
  })
  return json<RoundsStartResponse>(res)
}
```

#### Step 4: Progress 情報の明示 (低優先度)

**目的**: UI での進捗表示を容易にする

**変更箇所**:
- `workers/api/src/routes/rounds.ts` — レスポンスに `round.progress` を追加
- `web/src/features/quiz/api/types.ts` — 型定義に `round` フィールド追加

### 9.3 後方互換性戦略

Phase 2 への移行時、Phase 1 クライアントとの互換性を維持する方法:

#### オプション A: バージョニング

```typescript
// /v1/rounds/* → Phase 1 (既存)
// /v2/rounds/* → Phase 2 (新規)
```

#### オプション B: 段階的移行

1. トークン: JWS と Base64 の両方をサポート (検証時に自動判別)
2. Start: `GET` と `POST` の両方をサポート
3. 一定期間後に Phase 1 形式を廃止

推奨は**オプション B** (段階的移行)

### 9.4 移行タイムライン (想定)

| 期間 | タスク | 成果物 |
|------|--------|--------|
| **Week 1** | Step 1 (JWS 化) | トークン署名実装 |
| **Week 2** | Step 2 (スコア計算) | BE でスコア計算 |
| **Week 3** | Step 3 (POST 化) | フィルタ対応準備 |
| **Week 4** | Step 4 (Progress) | UI 改善 |
| **Week 5** | テスト・検証 | E2E テスト更新 |
| **Week 6** | 本番デプロイ | Phase 2 完了 |

## 10. Next Steps

Phase 1 統合完了後の次のステップ:

1. **監視・ログ設定**
   - Workers Analytics で API 使用状況を確認
   - Pages Analytics でフロントエンドのパフォーマンスを監視

2. **パフォーマンス最適化**
   - R2 Export のキャッシュ戦略
   - トークンの有効期限調整

3. **セキュリティ強化**
   - Rate Limiting の実装
   - CORS 設定の本番環境用調整

4. **Phase 2 移行開始**
   - 本セクション (9. Phase 2 Migration Roadmap) に従って実装

## 11. References

- [API Specification (Phase 2 理想仕様)](../api/api-spec.md)
- [Backend Architecture](../backend/architecture.md)
- [Phase 1 Implementation Plan](../backend/phase1-implementation.md)
- [Frontend Overview](../frontend/README.md)
- [Cloudflare Pages Docs](https://developers.cloudflare.com/pages/)
- [Next.js on Pages](https://developers.cloudflare.com/pages/framework-guides/nextjs/)
- [Current Implementation - rounds.ts](../../workers/api/src/routes/rounds.ts)
- [Current Implementation - token.ts](../../workers/api/src/lib/token.ts)
- [Frontend Datasource](../../web/src/features/quiz/datasource.ts)