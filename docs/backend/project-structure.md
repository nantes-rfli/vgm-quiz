# Project Structure – vgm-quiz Backend

- **Status**: Draft
- **Last Updated**: 2025-10-10
- **Purpose**: workers/ ディレクトリの構成とファイル配置ルール

## Directory Structure

```
vgm-quiz/
├── web/                    # 既存フロントエンド (Next.js)
├── docs/                   # ドキュメント
└── workers/                # 新規バックエンド (Cloudflare Workers)
    ├── api/                # API Worker
    │   ├── src/
    │   │   ├── index.ts           # エントリーポイント
    │   │   ├── routes/            # ルートハンドラ
    │   │   │   ├── daily.ts       # GET /daily
    │   │   │   └── health.ts      # GET /health
    │   │   └── lib/               # API 固有ロジック
    │   │       └── cors.ts        # CORS ヘッダー
    │   └── wrangler.toml          # API Worker 設定
    │
    ├── pipeline/           # Pipeline Worker
    │   ├── src/
    │   │   ├── index.ts           # エントリーポイント (Cron handler)
    │   │   ├── stages/            # パイプラインステージ
    │   │   │   ├── discovery.ts   # Discovery ステージ
    │   │   │   └── publish.ts     # Publish ステージ
    │   │   └── lib/               # Pipeline 固有ロジック
    │   │       ├── choices.ts     # 選択肢生成
    │   │       └── export.ts      # R2 Export
    │   └── wrangler.toml          # Pipeline Worker 設定
    │
    ├── shared/             # 共通コード (API + Pipeline で共有)
    │   ├── types/                 # TypeScript 型定義
    │   │   ├── track.ts           # Track, CuratedData など
    │   │   ├── export.ts          # DailyExport, Question など
    │   │   └── env.ts             # Env (Workers bindings)
    │   └── lib/                   # ユーティリティ関数
    │       ├── hash.ts            # SHA-256 ハッシュ計算
    │       ├── date.ts            # 日付操作 (JST 変換など)
    │       └── db.ts              # D1 ヘルパー関数
    │
    ├── migrations/         # D1 マイグレーション
    │   ├── 0001_initial.sql       # 初期テーブル作成
    │   └── 0002_add_indexes.sql   # インデックス追加 (Phase 2)
    │
    ├── data/               # 静的データ
    │   └── curated.json           # 手動キュレーションデータ
    │
    ├── tests/              # テストコード
    │   ├── unit/                  # Unit tests
    │   │   ├── hash.test.ts
    │   │   └── choices.test.ts
    │   ├── integration/           # Integration tests
    │   │   ├── discovery.test.ts
    │   │   └── publish.test.ts
    │   └── e2e/                   # E2E tests
    │       └── api.test.ts
    │
    ├── scripts/            # ユーティリティスクリプト
    │   └── validate-curated.ts    # curated.json 検証
    │
    ├── package.json        # npm 設定
    ├── tsconfig.json       # TypeScript 設定
    ├── biome.json          # Biome 設定
    └── vitest.config.ts    # Vitest 設定
```

## File Naming Conventions

### TypeScript Files

- **kebab-case**: ファイル名 (`daily-export.ts`, `hash-utils.ts`)
- **PascalCase**: クラス名 (使用しない、関数型で統一)
- **camelCase**: 関数名 (`generateChoices`, `computeHash`)
- **UPPER_SNAKE_CASE**: 定数 (`QUESTION_COUNT`, `COOLDOWN_DAYS`)

### Examples

```typescript
// ✅ Good
export function generateChoices(track: Track, pool: Track[]): Choice[] { }
export const QUESTION_COUNT = 10

// ❌ Bad
export function GenerateChoices(track: Track, pool: Track[]): Choice[] { }
export const questionCount = 10
```

## Import Path Aliases

### tsconfig.json

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/shared/*": ["./shared/*"]
    }
  }
}
```

### Usage

```typescript
// ✅ Good (absolute import)
import type { Track } from '@/shared/types/track'
import type { DailyExport } from '@/shared/types/export'
import { computeHash } from '@/shared/lib/hash'

// ❌ Bad (relative import from distant files)
import type { Track } from '../../../shared/types/track'
```

## Code Organization

### 1. API Worker Entry Point

**`workers/api/src/index.ts`**:
```typescript
import { handleDaily } from './routes/daily'
import { handleHealth } from './routes/health'
import { corsHeaders } from './lib/cors'

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders })
    }

    // Route handling
    if (url.pathname === '/daily') {
      return handleDaily(request, env)
    }

    if (url.pathname === '/health') {
      return handleHealth(request, env)
    }

    return new Response('Not Found', { status: 404 })
  },
}
```

### 2. Route Handler

**`workers/api/src/routes/daily.ts`**:
```typescript
import type { DailyExport } from '@/shared/types/export'
import { getTodayJST } from '@/shared/lib/date'
import { corsHeaders } from '../lib/cors'

export async function handleDaily(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const date = url.searchParams.get('date') || getTodayJST()

  // 1. Try R2 first
  const r2Key = `exports/daily/${date}.json`
  const obj = await env.STORAGE.get(r2Key)

  if (obj) {
    return new Response(await obj.text(), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }

  // 2. Fallback: D1
  const pick = await env.DB.prepare('SELECT items FROM picks WHERE date = ?')
    .bind(date)
    .first()

  if (!pick) {
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }

  return new Response(pick.items as string, {
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}
```

### 3. Pipeline Stage

**`workers/pipeline/src/stages/discovery.ts`**:
```typescript
import curatedData from '../../data/curated.json'
import type { CuratedData } from '@/shared/types/track'

export async function runDiscovery(db: D1Database): Promise<{ imported: number }> {
  const data = curatedData as CuratedData
  let imported = 0

  for (const track of data.tracks) {
    const result = await db
      .prepare(`
        INSERT INTO tracks_normalized (
          external_id,
          title,
          game,
          series,
          composer,
          platform,
          year,
          youtube_url,
          spotify_url
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(external_id) DO NOTHING
      `)
      .bind(
        track.id,
        track.title,
        track.game,
        track.series || null,
        track.composer || null,
        track.platform || null,
        track.year || null,
        track.youtube_url || null,
        track.spotify_url || null
      )
      .run()

    if (result.meta.changes > 0) {
      imported++
    }
  }

  return { imported }
}
```

### 4. Shared Utilities

**`workers/shared/lib/hash.ts`**:
```typescript
export async function computeSHA256(input: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(input)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
  return `sha256:${hashHex}`
}
```

**`workers/shared/lib/date.ts`**:
```typescript
export function getTodayJST(): string {
  const now = new Date()
  const jst = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }))
  return jst.toISOString().split('T')[0] // YYYY-MM-DD
}
```

## Environment Types

**`workers/shared/types/env.ts`**:
```typescript
export interface Env {
  DB: D1Database               // D1 binding
  STORAGE: R2Bucket            // R2 binding
  SPOTIFY_CLIENT_ID?: string   // Phase 2: Secrets
  SPOTIFY_CLIENT_SECRET?: string
}
```

## Testing Structure

### Unit Test Example

**`workers/tests/unit/hash.test.ts`**:
```typescript
import { describe, it, expect } from 'vitest'
import { computeSHA256 } from '@/shared/lib/hash'

describe('computeSHA256', () => {
  it('should return consistent hash for same input', async () => {
    const input = 'test'
    const hash1 = await computeSHA256(input)
    const hash2 = await computeSHA256(input)
    expect(hash1).toBe(hash2)
  })

  it('should return hash with sha256 prefix', async () => {
    const hash = await computeSHA256('test')
    expect(hash).toMatch(/^sha256:[0-9a-f]{64}$/)
  })
})
```

### Integration Test Example

**`workers/tests/integration/discovery.test.ts`**:
```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { env } from 'cloudflare:test'
import { runDiscovery } from '../../pipeline/src/stages/discovery'

describe('Discovery Stage', () => {
  beforeEach(async () => {
    // Reset DB
    await env.DB.prepare('DELETE FROM tracks_normalized').run()
  })

  it('should import curated data into D1', async () => {
    const result = await runDiscovery(env.DB)
    expect(result.imported).toBeGreaterThan(0)

    const count = await env.DB.prepare('SELECT COUNT(*) as count FROM tracks_normalized').first()
    expect(count.count).toBe(result.imported)
  })
})
```

## Configuration Files Summary

| File | Purpose |
|------|---------|
| `package.json` | npm dependencies, scripts |
| `tsconfig.json` | TypeScript compiler options |
| `biome.json` | Linter/formatter config |
| `vitest.config.ts` | Test runner config |
| `api/wrangler.toml` | API Worker config |
| `pipeline/wrangler.toml` | Pipeline Worker config |

## Build & Deployment

### Local Development

```bash
# Terminal 1: API Worker
npm run dev:api

# Terminal 2: Pipeline Worker
npm run dev:pipeline
```

### Type Checking

```bash
npm run typecheck
```

### Linting

```bash
npm run lint
```

### Testing

```bash
npm test
```

### Deployment

```bash
# Deploy both workers
npm run deploy:api
npm run deploy:pipeline
```

## Best Practices

### 1. Single Responsibility

- 1ファイル = 1機能
- ルートハンドラ、ステージ、ユーティリティを明確に分離

### 2. Type Safety

- すべてのファイルで strict mode
- `any` を避け、適切な型定義を使用

### 3. Error Handling

- エラーは適切にキャッチして返す
- 本番環境では詳細なエラーメッセージを隠す

### 4. Testing

- すべてのユーティリティ関数に unit test
- 各ステージに integration test
- API エンドポイントに E2E test

### 5. Documentation

- 複雑なロジックには JSDoc コメント
- README.md に概要を記載

## Next Steps

1. ✅ ディレクトリ構造を理解
2. ✅ ファイル配置ルールを把握
3. → 実装開始 ([phase1-implementation.md](../dev/phase1-implementation.md))
