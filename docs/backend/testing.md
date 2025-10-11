# Testing Strategy – vgm-quiz Backend

- **Status**: Draft
- **Last Updated**: 2025-10-10

## Overview

バックエンドのテストは3層構造:
1. **Unit Tests**: 各関数・モジュールの単体テスト
2. **Integration Tests**: ステージ間連携・DB/R2 アクセステスト
3. **E2E Tests**: API エンドポイントの動作確認

## Test Framework

| Layer | Tool | Purpose |
|-------|------|---------|
| **Unit** | Vitest | 関数ロジックのテスト |
| **Integration** | Vitest + Miniflare | Workers + D1/R2 のローカル実行 |
| **E2E** | Playwright | API エンドポイントの動作確認 |
| **Coverage** | Vitest (v8) | コードカバレッジ測定 |

## Unit Tests

### Scope
- Pure functions (hash 計算, データ正規化, スコア算出)
- Business logic (Guard ルール, Dedup アルゴリズム)
- Type validation (Envelope schema, Track schema)

### Example: Hash Calculation

```typescript
// shared/lib/hash.test.ts
import { describe, it, expect } from 'vitest'
import { computeHash } from './hash'

describe('computeHash', () => {
  it('should return consistent hash for same input', () => {
    const input = { stage: 'guard', data: { title: 'Test' } }
    const hash1 = computeHash(input)
    const hash2 = computeHash(input)
    expect(hash1).toBe(hash2)
  })

  it('should return different hash for different input', () => {
    const input1 = { stage: 'guard', data: { title: 'Test1' } }
    const input2 = { stage: 'guard', data: { title: 'Test2' } }
    expect(computeHash(input1)).not.toBe(computeHash(input2))
  })

  it('should produce SHA-256 hash with correct format', () => {
    const input = { stage: 'guard', data: {} }
    const hash = computeHash(input)
    expect(hash).toMatch(/^sha256:[0-9a-f]{64}$/)
  })
})
```

### Example: Guard Rules

```typescript
// pipeline/src/stages/guard.test.ts
import { describe, it, expect } from 'vitest'
import { validateTrack } from './guard'

describe('Guard: validateTrack', () => {
  it('should approve track with all required fields', () => {
    const track = {
      title: 'Green Hill Zone',
      game: 'Sonic the Hedgehog',
      composer: 'Masato Nakamura',
      year: 1991,
    }
    const result = validateTrack(track)
    expect(result.status).toBe('approved')
  })

  it('should reject track with missing required field', () => {
    const track = {
      title: 'Green Hill Zone',
      game: 'Sonic the Hedgehog',
      // missing composer
    }
    const result = validateTrack(track)
    expect(result.status).toBe('rejected')
    expect(result.reasons).toContain('missing_composer')
  })

  it('should reject track with blacklisted keyword', () => {
    const track = {
      title: 'Test (Unreleased Demo)',
      game: 'Test Game',
      composer: 'Test Composer',
    }
    const result = validateTrack(track)
    expect(result.status).toBe('rejected')
    expect(result.reasons).toContain('blacklisted_keyword')
  })
})
```

## Integration Tests

### Scope
- Pipeline stages with D1/R2 access
- Cron trigger handlers
- Audit log persistence
- Idempotency checks

### Setup: Miniflare

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'miniflare',
    environmentOptions: {
      bindings: {
        DB: { /* D1 mock */ },
        STORAGE: { /* R2 mock */ },
      },
    },
  },
})
```

### Example: Discovery Stage

```typescript
// pipeline/src/stages/discovery.integration.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { runDiscovery } from './discovery'
import { D1Database } from '@cloudflare/workers-types'

describe('Discovery Stage (Integration)', () => {
  let db: D1Database

  beforeEach(async () => {
    // Reset test database
    await db.exec('DELETE FROM discovery_items')
    await db.exec('DELETE FROM audits')
  })

  it('should insert new discovery items into D1', async () => {
    const input = {
      sources: [
        { type: 'manual', url: 'file://curated.json' },
      ],
    }

    const result = await runDiscovery(db, input)

    expect(result.payload.status).toBe('ok')
    expect(result.payload.output.items_discovered).toBeGreaterThan(0)

    // Verify D1 insertion
    const rows = await db.prepare('SELECT COUNT(*) as count FROM discovery_items').first()
    expect(rows.count).toBeGreaterThan(0)
  })

  it('should record audit log with input/output hash', async () => {
    const input = { sources: [] }
    await runDiscovery(db, input)

    const audit = await db
      .prepare('SELECT * FROM audits WHERE stage = ? ORDER BY started_at DESC LIMIT 1')
      .bind('discovery')
      .first()

    expect(audit).toBeDefined()
    expect(audit.ok).toBe(true)
    expect(audit.input_hash).toMatch(/^sha256:/)
    expect(audit.output_hash).toMatch(/^sha256:/)
  })

  it('should skip if same input_hash already succeeded', async () => {
    const input = { sources: [{ type: 'manual', url: 'file://curated.json' }] }

    // First run
    const result1 = await runDiscovery(db, input)
    expect(result1.payload.status).toBe('ok')

    // Second run (idempotent)
    const result2 = await runDiscovery(db, input)
    expect(result2.payload.status).toBe('ok')
    expect(result2.payload.output.skipped).toBe(true)
  })
})
```

### Example: R2 Export

```typescript
// pipeline/src/stages/publish.integration.test.ts
import { describe, it, expect } from 'vitest'
import { exportToR2 } from './publish'
import { R2Bucket } from '@cloudflare/workers-types'

describe('Publish: Export to R2', () => {
  let storage: R2Bucket

  it('should upload daily JSON to R2', async () => {
    const picks = [
      { track_id: 1, title: 'Green Hill Zone', choices: [...] },
      // ... 9 more
    ]

    const result = await exportToR2(storage, picks, '2025-10-10')

    expect(result.status).toBe('ok')
    expect(result.r2_key).toBe('exports/2025-10-10.json')

    // Verify R2 upload
    const obj = await storage.get('exports/2025-10-10.json')
    expect(obj).toBeDefined()

    const json = await obj.json()
    expect(json.questions).toHaveLength(10)
  })

  it('should include version and hash in export metadata', async () => {
    const picks = [/* ... */]
    await exportToR2(storage, picks, '2025-10-10')

    const obj = await storage.get('exports/2025-10-10.json')
    const json = await obj.json()

    expect(json.meta.version).toMatch(/^\d+\.\d+\.\d+$/)
    expect(json.meta.hash).toMatch(/^sha256:/)
  })
})
```

## E2E Tests

### Scope
- API endpoints (`GET /daily`, `GET /v1/rounds/start`, etc.)
- Cron-triggered pipeline execution
- Error handling (404, 500)
- CORS headers

### Setup: Playwright + Deployed Worker

```typescript
// tests/e2e/api.spec.ts
import { test, expect } from '@playwright/test'

const API_BASE = process.env.API_URL || 'http://localhost:8787'

test.describe('API Endpoints', () => {
  test('GET /daily should return 10 questions', async ({ request }) => {
    const response = await request.get(`${API_BASE}/daily?date=2025-10-10`)
    expect(response.ok()).toBeTruthy()

    const json = await response.json()
    expect(json.questions).toHaveLength(10)
    expect(json.meta.date).toBe('2025-10-10')
  })

  test('GET /daily with invalid date should return 400', async ({ request }) => {
    const response = await request.get(`${API_BASE}/daily?date=invalid`)
    expect(response.status()).toBe(400)
  })

  test('GET /daily without date should default to today', async ({ request }) => {
    const response = await request.get(`${API_BASE}/daily`)
    expect(response.ok()).toBeTruthy()

    const json = await response.json()
    const today = new Date().toISOString().split('T')[0]
    expect(json.meta.date).toBe(today)
  })

  test('GET /v1/rounds/start should return first question', async ({ request }) => {
    const response = await request.get(`${API_BASE}/v1/rounds/start`)
    expect(response.ok()).toBeTruthy()

    const json = await response.json()
    expect(json.question).toBeDefined()
    expect(json.choices).toHaveLength(4)
    expect(json.continuationToken).toBeDefined()
  })

  test('CORS headers should be present', async ({ request }) => {
    const response = await request.get(`${API_BASE}/daily`)
    const headers = response.headers()
    expect(headers['access-control-allow-origin']).toBe('*')
  })
})
```

### Cron Testing (Manual Trigger)

```typescript
// tests/e2e/pipeline.spec.ts
import { test, expect } from '@playwright/test'

const PIPELINE_URL = process.env.PIPELINE_URL || 'http://localhost:8788'

test.describe('Pipeline Execution', () => {
  test('Manual trigger /trigger/discovery should run Discovery stage', async ({ request }) => {
    const response = await request.post(`${PIPELINE_URL}/trigger/discovery`)
    expect(response.ok()).toBeTruthy()

    const json = await response.json()
    expect(json.stage).toBe('discovery')
    expect(json.status).toBe('ok')
  })

  test('Manual trigger /trigger/all should run full pipeline', async ({ request }) => {
    const response = await request.post(`${PIPELINE_URL}/trigger/all`, {
      timeout: 60000, // 60s
    })
    expect(response.ok()).toBeTruthy()

    const json = await response.json()
    expect(json.stages).toHaveLength(6)
    expect(json.stages.every((s) => s.status === 'ok')).toBe(true)
  })
})
```

## Coverage Goals

| Component | Target |
|-----------|--------|
| **Shared lib** | 90%+ |
| **Pipeline stages** | 80%+ |
| **API handlers** | 70%+ |
| **Overall** | 75%+ |

```bash
# Generate coverage report
cd workers
npm run test:coverage

# View HTML report
open coverage/index.html
```

## Test Data

### Fixtures Location
```
workers/tests/fixtures/
├── curated.json          # Phase 1 手動キュレーション
├── tracks-sample.json    # サンプル楽曲データ
├── clusters-sample.json  # Dedup テスト用
└── exports-sample.json   # Export フォーマット例
```

### Example Fixture: curated.json

```json
{
  "version": "1.0.0",
  "tracks": [
    {
      "external_id": "manual:001",
      "title": "Green Hill Zone",
      "game": "Sonic the Hedgehog",
      "series": "Sonic",
      "composer": "Masato Nakamura",
      "platform": "Genesis",
      "year": 1991,
      "length_sec": 120,
      "url": "https://www.youtube.com/watch?v=example"
    }
  ]
}
```

## Continuous Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/backend-test.yml
name: Backend Tests

on:
  pull_request:
    paths:
      - 'workers/**'
  push:
    branches:
      - main

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: |
          cd workers
          npm ci

      - name: Type check
        run: |
          cd workers
          npm run typecheck

      - name: Lint
        run: |
          cd workers
          npm run lint

      - name: Unit & Integration Tests
        run: |
          cd workers
          npm run test:coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          files: ./workers/coverage/coverage-final.json
```

## Best Practices

### 1. Test Naming Convention
- **Pattern**: `describe('Component: method', () => { it('should ...', ...) })`
- **Example**: `describe('Guard: validateTrack', () => { it('should approve valid track', ...) })`

### 2. Arrange-Act-Assert (AAA)
```typescript
it('should return hash with sha256 prefix', () => {
  // Arrange
  const input = { data: 'test' }

  // Act
  const hash = computeHash(input)

  // Assert
  expect(hash).toMatch(/^sha256:/)
})
```

### 3. Test Isolation
- 各テストは独立して実行可能
- `beforeEach` で状態リセット
- モックは最小限に (実際の D1/R2 を Miniflare で使う)

### 4. Snapshot Testing (避ける)
- JSON 構造が頻繁に変わるため、スナップショットテストは避ける
- 代わりに明示的なアサーションを使う

### 5. Error Scenarios
- 正常系だけでなく異常系もテスト
- エラーメッセージの内容も検証

```typescript
it('should throw error with helpful message on invalid input', () => {
  expect(() => validateTrack(null)).toThrow('track cannot be null')
})
```

## Running Tests Locally

```bash
cd workers

# All tests
npm test

# Watch mode (開発時)
npm run test:watch

# Specific file
npx vitest run pipeline/src/stages/guard.test.ts

# With coverage
npm run test:coverage
```

## Troubleshooting

### Issue: Miniflare bindings not working

**Solution**: Check `vitest.config.ts` bindings match `wrangler.toml`

### Issue: R2 mock returns undefined

**Solution**: Use `getMockR2Bucket()` helper from Miniflare docs

### Issue: D1 queries timeout in tests

**Solution**: Reduce test dataset size or increase timeout

```typescript
it('should process large dataset', async () => {
  // ...
}, { timeout: 10000 }) // 10s
```
