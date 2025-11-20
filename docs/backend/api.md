# API Specification – vgm-quiz Backend

- **Status**: Draft
- **Last Updated**: 2025-11-19

## Overview

Cloudflare Workers で実装する API エンドポイント。フロントエンド (Next.js) と互換性を保つため、既存の MSW モックと同じレスポンス形式を使用。

## Base URL

- **Production**: `https://api.vgm-quiz.example.com` (Cloudflare Workers)
- **Development**: `http://localhost:8787` (Miniflare)

## Authentication

Phase 1 では認証なし (Public API)。Phase 2 以降で API Key or JWT を検討。

## Endpoints

### 1. GET /daily

日次問題セットを取得 (R2 から直接配信)。

#### Request

```http
GET /daily?date=2025-10-10 HTTP/1.1
Host: api.vgm-quiz.example.com
```

**Query Parameters**:
- `date` (optional): YYYY-MM-DD 形式。省略時は今日 (JST) の問題セット。
- `backup` (optional): `1` または `true` を指定すると、canonical (`exports/daily/`) が欠損している場合に `backups/daily/` を参照し `X-VGM-Daily-Source: backup` を返す。

#### Response (200 OK)

```json
{
  "meta": {
    "date": "2025-10-10",
    "version": "1.0.0",
    "generated_at": "2025-10-09T15:00:00Z",
    "hash": "sha256:abc123..."
  },
  "questions": [
    {
      "id": "q_2025-10-10_1",
      "track_id": 42,
      "title": "Green Hill Zone",
      "game": "Sonic the Hedgehog",
      "choices": [
        { "id": "a", "text": "Sonic the Hedgehog", "correct": true },
        { "id": "b", "text": "Super Mario Bros.", "correct": false },
        { "id": "c", "text": "The Legend of Zelda", "correct": false },
        { "id": "d", "text": "Mega Man", "correct": false }
      ],
      "reveal": {
        "composer": "Masato Nakamura",
        "year": 1991,
        "platform": "Genesis",
        "series": "Sonic",
        "youtube_url": "https://youtube.com/watch?v=...",
        "spotify_url": "https://open.spotify.com/track/..."
      },
      "meta": {
        "difficulty": 35,
        "notability": 85,
        "quality": 90
      }
    }
    // ... 9 more questions
  ]
}
```

**Response Headers**
- `X-VGM-Daily-Source: primary | backup`

#### Response (404 Not Found)

```json
{
  "error": "Not found",
  "message": "No backup export for 2025-10-10"
}
```
※ `backup` パラメータを付与しない場合は `"No question set for ..."` になる。

#### Implementation

```typescript
export async function handleDailyRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const date = url.searchParams.get('date') || getTodayJST()
  const backupRequested = url.searchParams.get('backup') === '1'

  if (!isValidDateFormat(date)) {
    return new Response(
      JSON.stringify({ error: 'Invalid date format', message: 'Use YYYY-MM-DD' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  let payload = await fetchDailyQuestions(env, date)
  let source: 'primary' | 'backup' = 'primary'

  if (!payload && backupRequested) {
    payload = await fetchBackupDaily(env, date)
    if (payload) {
      source = 'backup'
      logEvent(env, 'info', {
        event: 'api.daily.backup',
        status: 'success',
        fields: { date },
      })
    }
  }

  if (!payload) {
    const message = backupRequested
      ? `No backup export for ${date}`
      : `No question set for ${date}`
    return new Response(JSON.stringify({ error: 'Not found', message }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify(payload), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
      'X-VGM-Daily-Source': source,
    },
  })
}
```

---

### 2. POST /v1/rounds/start

ラウンド開始。`mode` と `filters` を指定して Publish 済みの問題セットから復元する。

#### Request

```http
POST /v1/rounds/start HTTP/1.1
Host: api.vgm-quiz.example.com
Content-Type: application/json

{
  "mode": "vgm_v1-ja",
  "filters": { "difficulty": "mixed", "era": "90s" },
  "total": 10
}
```

#### Response (200 OK)

```json
{
  "round": {
    "id": "round_2025-11-03_t8s",
    "mode": "vgm_v1-ja",
    "date": "2025-11-03",
    "filters": { "difficulty": "mixed", "era": "90s" },
    "progress": { "index": 1, "total": 10 },
    "token": "<JWS-compact-string>"
  },
  "question": {
    "id": "q_2025-11-03_1",
    "title": "この曲のゲームタイトルは?"
  },
  "choices": [
    { "id": "a", "text": "Sonic the Hedgehog" },
    { "id": "b", "text": "Super Mario Bros." },
    { "id": "c", "text": "The Legend of Zelda" },
    { "id": "d", "text": "Mega Man" }
  ],
  "continuationToken": "<JWS-compact-string>",
  "progress": { "index": 1, "total": 10 }
}
```

- `503 no_questions`: 指定フィルタで Publish 済みセットが存在しない
- `422 insufficient_inventory`: `total` が Publish 済みセットと一致しない
- `400 bad_request`: フィルタ値が無効

#### Implementation (抜粋)

```typescript
const normalizedFilters = normalizeFilters(requestFilters)
const filterKey = createFilterKey(normalizedFilters)
const exportData = await fetchRoundExport(env, date, filterKey)

const token = await createJWSToken(
  {
    rid: roundId,
    idx: 0,
    total: exportData.questions.length,
    seed,
    filtersHash: hashFilterKey(filterKey),
    filtersKey: filterKey,
    mode: mode.id,
    date,
    ver: 1,
    aud: 'rounds',
  },
  env.JWT_SECRET,
)
```

---

### 3. POST /v1/rounds/next

次問題取得 + 前問題の正解判定。

#### Request

```http
POST /v1/rounds/next HTTP/1.1
Host: api.vgm-quiz.example.com
Content-Type: application/json

{
  "continuationToken": "eyJ...",
  "answer": "a"
}
```

#### Response (200 OK)

```json
{
  "result": {
    "correct": true,
    "correctAnswer": "a",
    "reveal": {
      "title": "Green Hill Zone",
      "game": "Sonic the Hedgehog",
      "composer": "Masato Nakamura",
      "year": 1991,
      "platform": "Genesis",
      "series": "Sonic",
      "youtube_url": "https://youtube.com/watch?v=...",
      "spotify_url": "https://open.spotify.com/track/..."
    }
  },
  "question": {
    "id": "q_2025-10-10_2",
    "title": "この曲のゲームタイトルは?"
  },
  "choices": [
    { "id": "a", "text": "Final Fantasy VII" },
    { "id": "b", "text": "Chrono Trigger" },
    { "id": "c", "text": "Secret of Mana" },
    { "id": "d", "text": "Super Mario RPG" }
  ],
  "continuationToken": "eyJ...",
  "finished": false
}
```

**finished**: 最終問題の場合 `true`。

#### Response (Last Question)

```json
{
  "result": { /* ... */ },
  "finished": true
}
```

#### Implementation

```typescript
export async function handleRoundsNext(
  request: Request,
  env: Env
): Promise<Response> {
  const body = await request.json()
  const { continuationToken, answer } = body

  // 1. Decode token
  const token = await decodeContinuationToken(continuationToken)
  if (!token) {
    return new Response(
      JSON.stringify({ error: 'Invalid token', message: 'Continuation token is invalid or expired' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const { date, currentIndex } = token

  // 2. Get question set
  const daily = await fetchDailyQuestions(env, date)
  if (!daily) {
    return new Response(
      JSON.stringify({ error: 'Not found', message: `Question set for ${date} no longer available` }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // 3. Validate currentIndex
  if (currentIndex < 0 || currentIndex >= daily.questions.length) {
    return new Response(
      JSON.stringify({ error: 'Invalid state', message: 'Question index out of bounds' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const currentQuestion = daily.questions[currentIndex]

  // 4. Check answer
  const correctChoice = currentQuestion.choices.find((c) => c.correct)
  if (!correctChoice) {
    return new Response(
      JSON.stringify({ error: 'Internal error', message: 'Question has no correct answer' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const isCorrect = answer === correctChoice.id

  // 5. Prepare response
  const response: any = {
    result: {
      correct: isCorrect,
      correctAnswer: correctChoice.id,
      reveal: currentQuestion.reveal,
    },
  }

  // 6. Check if finished
  const nextIndex = currentIndex + 1
  if (nextIndex >= daily.questions.length) {
    response.finished = true
  } else {
    const nextQuestion = daily.questions[nextIndex]
    response.question = {
      id: nextQuestion.id,
      title: 'この曲のゲームタイトルは?',
    }
    response.choices = nextQuestion.choices.map((c) => ({ id: c.id, text: c.text }))
    response.continuationToken = await createContinuationToken({
      date,
      currentIndex: nextIndex,
      totalQuestions: daily.questions.length,
    })
    response.finished = false
  }

  return new Response(JSON.stringify(response), {
    headers: { 'Content-Type': 'application/json' },
  })
}
```

---

### 4. POST /v1/metrics (Phase 2)

メトリクス送信 (フロントエンドの metrics client から呼ばれる)。

#### Request

```http
POST /v1/metrics HTTP/1.1
Host: api.vgm-quiz.example.com
Content-Type: application/json

{
  "clientId": "uuid-...",
  "events": [
    {
      "type": "round_start",
      "timestamp": "2025-10-10T00:00:00Z",
      "data": { "date": "2025-10-10" }
    },
    {
      "type": "answer_submit",
      "timestamp": "2025-10-10T00:01:23Z",
      "data": { "question_id": "q_2025-10-10_1", "answer": "a", "correct": true }
    }
  ]
}
```

#### Response (200 OK)

```json
{
  "received": 2
}
```

#### Implementation

```typescript
export async function handleMetrics(
  request: Request,
  env: Env
): Promise<Response> {
  const body = await request.json()
  const { clientId, events } = body

  // 1. Validate events
  if (!Array.isArray(events) || events.length === 0) {
    return new Response(JSON.stringify({ error: 'Invalid events' }), { status: 400 })
  }

  // 2. Insert into D1 (Phase 2: use Analytics Engine instead)
  for (const event of events) {
    await env.DB.prepare(
      `INSERT INTO metrics (client_id, event_type, timestamp, data)
       VALUES (?, ?, ?, ?)`
    )
      .bind(clientId, event.type, event.timestamp, JSON.stringify(event.data))
      .run()
  }

  return new Response(JSON.stringify({ received: events.length }), {
    headers: { 'Content-Type': 'application/json' },
  })
}
```

---

## CORS Headers

すべてのエンドポイントで CORS を許可:

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

// OPTIONS request handler
export function handleOptions(): Response {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  })
}
```

## Rate Limiting (Phase 2)

Cloudflare Workers の Rate Limiting API を使用:

```typescript
const rateLimiter = {
  limit: 100, // requests per minute
  period: 60,
}

export async function checkRateLimit(
  request: Request,
  env: Env
): Promise<boolean> {
  const ip = request.headers.get('CF-Connecting-IP')
  const key = `rate:${ip}`

  const count = await env.KV.get(key)
  if (count && parseInt(count) >= rateLimiter.limit) {
    return false
  }

  await env.KV.put(key, (parseInt(count || '0') + 1).toString(), {
    expirationTtl: rateLimiter.period,
  })

  return true
}
```

## Error Responses

統一エラーフォーマット:

```json
{
  "error": "Error type",
  "message": "Human-readable message",
  "code": 400
}
```

| Status | Error Type | Example |
|--------|-----------|---------|
| **400** | `invalid_request` | Invalid date format |
| **404** | `not_found` | No question set for date |
| **429** | `rate_limit_exceeded` | Too many requests |
| **500** | `internal_error` | Database error |
| **503** | `service_unavailable` | R2 temporarily unavailable |

## Testing

E2E テストで API エンドポイントを検証:

```typescript
// tests/e2e/api.spec.ts
import { test, expect } from '@playwright/test'

test('GET /daily returns 10 questions', async ({ request }) => {
  const response = await request.get('http://localhost:8787/daily')
  expect(response.ok()).toBeTruthy()

  const json = await response.json()
  expect(json.questions).toHaveLength(10)
})

test('POST /v1/rounds/next returns correct answer', async ({ request }) => {
  const startResponse = await request.get('http://localhost:8787/v1/rounds/start')
  const startJson = await startResponse.json()

  const nextResponse = await request.post('http://localhost:8787/v1/rounds/next', {
    data: {
      continuationToken: startJson.continuationToken,
      answer: 'a',
    },
  })

  const nextJson = await nextResponse.json()
  expect(nextJson.result).toBeDefined()
  expect(nextJson.result.correct).toBeTypeOf('boolean')
})
```

## Monitoring

Cloudflare Workers Analytics で監視:

- **Request count**: エンドポイント別
- **Latency**: p50/p95/p99
- **Error rate**: 4xx/5xx
- **R2 cache hit rate**: `/daily` エンドポイント
