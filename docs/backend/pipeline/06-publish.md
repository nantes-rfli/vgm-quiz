# Publish Stage – Pipeline

- **Status**: Draft
- **Last Updated**: 2025-10-10

## Purpose

Pool 管理 + 日次選定 + JSON Export を統合したステージ。Publish = Pool + Picker + Export の3機能を実行。

## Sub-stages

### 1. Pool Management
- **Input**: `scores[]` (difficulty, notability, quality)
- **Process**: Pool に楽曲を追加/更新、cooldown 管理
- **Output**: `pool[]` (状態: available/cooldown)

### 2. Picker (Daily Selection)
- **Input**: `pool[]` (状態が available の楽曲)
- **Process**: 10曲選定 + 各4選択肢生成
- **Output**: `picks[]` (date, questions, choices)

### 3. Export to R2
- **Input**: `picks[]`
- **Process**: JSON 生成 + R2 アップロード
- **Output**: R2 key (`/exports/daily/YYYY-MM-DD.json`)

## Input

```typescript
interface PublishInput {
  date: string              // Target date (YYYY-MM-DD)
  force_regenerate?: boolean // Ignore existing export
}
```

## Output

```typescript
interface PublishOutput {
  date: string
  tracks_selected: number
  r2_key: string            // e.g., "exports/daily/2025-10-10.json"
  export_hash: string       // SHA-256 of exported JSON
  export_version: string    // Semantic version
}
```

## Storage

### D1 Tables

```sql
-- Pool state
CREATE TABLE pool (
  track_id INTEGER PRIMARY KEY,
  state TEXT DEFAULT 'available',  -- 'available' | 'cooldown'
  cooldown_until TIMESTAMP,
  last_picked_at TIMESTAMP,
  times_picked INTEGER DEFAULT 0,
  tags TEXT[],                     -- ['easy', 'popular', 'rpg']
  FOREIGN KEY(track_id) REFERENCES tracks_normalized(track_id)
);

CREATE INDEX idx_pool_state ON pool(state, cooldown_until);

-- Daily picks
CREATE TABLE picks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,       -- YYYY-MM-DD
  items TEXT NOT NULL,             -- JSON array of question objects
  status TEXT DEFAULT 'pending',   -- 'pending' | 'exported' | 'failed'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Export metadata
CREATE TABLE exports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  r2_key TEXT NOT NULL,            -- R2 object key
  version TEXT NOT NULL,           -- Semantic version
  hash TEXT NOT NULL,              -- SHA-256 of JSON
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Process Logic

### 1. Pool Management

```typescript
async function updatePool(db: D1Database, scores: Score[]): Promise<void> {
  for (const score of scores) {
    // Insert or update pool entry
    await db.prepare(`
      INSERT INTO pool (track_id, state, cooldown_until, last_picked_at, times_picked, tags)
      VALUES (?, 'available', NULL, NULL, 0, ?)
      ON CONFLICT(track_id) DO UPDATE SET
        tags = excluded.tags,
        state = CASE
          WHEN pool.cooldown_until IS NOT NULL AND pool.cooldown_until > datetime('now')
          THEN 'cooldown'
          ELSE 'available'
        END,
        cooldown_until = CASE
          WHEN pool.cooldown_until IS NOT NULL AND pool.cooldown_until > datetime('now')
          THEN pool.cooldown_until
          ELSE NULL
        END
    `).bind(score.track_id, JSON.stringify(score.tags || [])).run()
  }
}
```

### 2. Picker (Daily Selection)

```typescript
async function pickDailyQuestions(db: D1Database, date: string): Promise<Pick[]> {
  // 1. Get available tracks (not in cooldown)
  const available = await db.prepare(`
    SELECT p.track_id, t.title, t.game, t.composer, s.difficulty, s.notability
    FROM pool p
    JOIN tracks_normalized t ON p.track_id = t.track_id
    JOIN scores s ON p.track_id = s.track_id
    WHERE p.state = 'available'
    ORDER BY s.difficulty ASC, s.notability DESC
  `).all()

  // 2. Select 10 tracks with diversity constraints
  const selected = selectWithDiversity(available.results, {
    count: 10,
    constraints: {
      max_same_series: 2,      // Max 2 tracks from same series
      max_same_composer: 2,
      difficulty_range: [20, 80], // Avoid too easy/hard
    },
  })

  // 3. Generate 4 choices for each track (1 correct + 3 wrong)
  const questions = await Promise.all(
    selected.map(async (track) => ({
      track_id: track.track_id,
      choices: await generateChoices(db, track, available.results),
    }))
  )

  // 4. Insert into picks table
  await db.prepare(`
    INSERT INTO picks (date, items, status)
    VALUES (?, ?, 'pending')
  `).bind(date, JSON.stringify(questions)).run()

  // 5. Update pool state (set cooldown)
  const cooldownDays = 7
  for (const track of selected) {
    await db.prepare(`
      UPDATE pool
      SET state = 'cooldown',
          cooldown_until = datetime('now', '+${cooldownDays} days'),
          last_picked_at = datetime('now'),
          times_picked = times_picked + 1
      WHERE track_id = ?
    `).bind(track.track_id).run()
  }

  return questions
}
```

### 3. Export to R2

```typescript
async function exportToR2(
  storage: R2Bucket,
  db: D1Database,
  date: string
): Promise<PublishOutput> {
  // 1. Get picks from D1
  const pick = await db.prepare('SELECT items FROM picks WHERE date = ?').bind(date).first()

  if (!pick) {
    throw new Error(`No picks found for date ${date}`)
  }

  // 2. Build export JSON
  const exportData = {
    meta: {
      date,
      version: '1.0.0',
      generated_at: new Date().toISOString(),
    },
    questions: JSON.parse(pick.items).map((q, index) => ({
      id: `q_${date}_${index + 1}`,
      track_id: q.track_id,
      choices: q.choices,
      // Add metadata from tracks/scores tables
    })),
  }

  // 3. Compute hash
  const hash = await computeSHA256(JSON.stringify(exportData))

  // 4. Upload to R2
  const r2Key = `exports/daily/${date}.json`
  await storage.put(r2Key, JSON.stringify(exportData), {
    httpMetadata: {
      contentType: 'application/json',
      cacheControl: 'public, max-age=3600',
    },
    customMetadata: {
      version: '1.0.0',
      hash,
    },
  })

  // 5. Record in exports table
  await db.prepare(`
    INSERT INTO exports (date, r2_key, version, hash)
    VALUES (?, ?, ?, ?)
  `).bind(date, r2Key, '1.0.0', hash).run()

  // 6. Update picks status
  await db.prepare(`
    UPDATE picks SET status = 'exported' WHERE date = ?
  `).bind(date).run()

  return {
    date,
    tracks_selected: exportData.questions.length,
    r2_key: r2Key,
    export_hash: hash,
    export_version: '1.0.0',
  }
}
```

#### Choice Generation

```typescript
type TrackWithScores = Track & {
  difficulty: number
  notability: number
}

interface Choice {
  id: string
  text: string
  correct: boolean
}

async function generateChoices(
  db: D1Database,
  correctTrack: TrackWithScores,
  candidatePool: TrackWithScores[]
): Promise<Choice[]> {
  const distractors = candidatePool
    .filter((candidate) => candidate.track_id !== correctTrack.track_id)
    .filter((candidate) =>
      Math.abs(candidate.difficulty - correctTrack.difficulty) <= 10 &&
      candidate.series !== correctTrack.series
    )
    .slice(0, 10)

  if (distractors.length < 3) {
    const fallback = await db.prepare(`
      SELECT title, track_id FROM tracks_normalized
      WHERE track_id != ?
      ORDER BY RANDOM()
      LIMIT ?
    `).bind(correctTrack.track_id, 3 - distractors.length).all()

    distractors.push(...fallback.results)
  }

  const wrongChoices = shuffle(distractors).slice(0, 3).map((track, index) => ({
    id: String.fromCharCode(98 + index), // 'b', 'c', 'd'
    text: track.title,
    correct: false,
  }))

  return [
    { id: 'a', text: correctTrack.title, correct: true },
    ...wrongChoices,
  ]
}

function shuffle<T>(items: T[]): T[] {
  const array = [...items]
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = array[i]
    array[i] = array[j]
    array[j] = tmp
  }
  return array
}
```

## Export JSON Format

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

## Diversity Constraints

```typescript
function selectWithDiversity(tracks: Track[], config: DiversityConfig): Track[] {
  const selected: Track[] = []
  const seriesCount = new Map<string, number>()
  const composerCount = new Map<string, number>()

  for (const track of tracks) {
    // Check constraints
    if (seriesCount.get(track.series) >= config.max_same_series) continue
    if (composerCount.get(track.composer) >= config.max_same_composer) continue
    if (track.difficulty < config.difficulty_range[0]) continue
    if (track.difficulty > config.difficulty_range[1]) continue

    // Add to selection
    selected.push(track)
    seriesCount.set(track.series, (seriesCount.get(track.series) || 0) + 1)
    composerCount.set(track.composer, (composerCount.get(track.composer) || 0) + 1)

    if (selected.length >= config.count) break
  }

  return selected
}
```

## Cron Schedule

```typescript
// wrangler.toml
[triggers]
crons = ["0 15 * * *"]  // Daily at 15:00 UTC (00:00 JST)
```

## Idempotency

- **Check**: `exports` テーブルで同一 `date` の成功記録があればスキップ
- **Force Regenerate**: `force_regenerate=true` で既存を上書き

## Error Handling

| Error | Action |
|-------|--------|
| **No available tracks** | `audits.ok=false` 記録、前日 Export を再利用 |
| **R2 upload failure** | 指数バックオフで3回リトライ |
| **Insufficient diversity** | 制約を緩和して再試行 |

## Monitoring

- **Metrics**: `tracks_selected`, `export_size_bytes`, execution time
- **Alerts**: Export 失敗時に Slack 通知 (Phase 2)

## Frontend Integration

フロントエンドは `GET /daily?date=YYYY-MM-DD` で R2 から直接取得:

```typescript
// workers/api/src/routes/daily.ts
async function handleDailyRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const date = url.searchParams.get('date') || getTodayJST()

  // 1. Try R2 first
  const r2Key = `exports/daily/${date}.json`
  const obj = await env.STORAGE.get(r2Key)

  if (obj) {
    return new Response(await obj.text(), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600',
      },
    })
  }

  // 2. Fallback: Generate from D1 (no cache)
  const pick = await env.DB.prepare('SELECT items FROM picks WHERE date = ?').bind(date).first()

  if (!pick) {
    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 })
  }

  return new Response(pick.items, {
    headers: { 'Content-Type': 'application/json' },
  })
}
```
