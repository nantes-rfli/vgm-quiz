# Score Stage – Pipeline

- **Status**: Draft
- **Last Updated**: 2025-10-10

## Purpose

難易度・周知度・品質をスコア化し、問題選定の基準を作成。

## Phase Implementation

| Phase | Method |
|-------|--------|
| **1 (MVP)** | Static (メタデータベース: year, series) |
| **2** | + Acoustic (BPM, テンポ変化, イントロ長) |
| **3** | + Behavioral (ユーザー正答率フィードバック) |

## Input

```typescript
interface ScoreInput {
  tracks: {
    track_id: number
    title: string
    game: string
    series: string
    year: number
    length_sec: number
  }[]
}
```

## Output

```typescript
interface ScoreOutput {
  scores: {
    track_id: number
    difficulty: number    // 0-100
    notability: number    // 0-100
    quality: number       // 0-100
    tags: string[]
  }[]
}
```

## Scoring Logic (Phase 1: Static)

### 1. Difficulty

```typescript
function calculateDifficulty(track: Track): number {
  let score = 50 // Base

  // Older games are harder (less familiar)
  const currentYear = new Date().getFullYear()
  const age = currentYear - track.year
  score += Math.min(age / 2, 30) // Max +30 for very old games

  // Popular series are easier
  const popularSeries = ['Mario', 'Zelda', 'Final Fantasy', 'Pokemon', 'Sonic']
  if (popularSeries.some((s) => track.series?.includes(s))) {
    score -= 20
  }

  return Math.max(0, Math.min(100, score))
}
```

### 2. Notability

```typescript
function calculateNotability(track: Track): number {
  let score = 50 // Base

  // Well-known series boost notability
  const topSeries = ['Final Fantasy', 'Zelda', 'Mario', 'Pokemon']
  if (topSeries.some((s) => track.series?.includes(s))) {
    score += 30
  }

  // Recent games are more notable
  const currentYear = new Date().getFullYear()
  const age = currentYear - track.year
  if (age < 5) score += 20
  else if (age < 10) score += 10

  return Math.max(0, Math.min(100, score))
}
```

### 3. Quality

```typescript
function calculateQuality(track: Track): number {
  let score = 50 // Base

  // Check metadata completeness
  const requiredFields = ['title', 'game', 'composer', 'year', 'series']
  const completeness = requiredFields.filter((f) => track[f]).length / requiredFields.length
  score += completeness * 30

  // Length preference (1-3 min ideal)
  if (track.length_sec >= 60 && track.length_sec <= 180) {
    score += 20
  }

  return Math.max(0, Math.min(100, score))
}
```

### 4. Tags

```typescript
function generateTags(track: Track, scores: { difficulty: number; notability: number }): string[] {
  const tags: string[] = []

  // Difficulty tags
  if (scores.difficulty < 30) tags.push('easy')
  else if (scores.difficulty > 70) tags.push('hard')

  // Notability tags
  if (scores.notability > 70) tags.push('popular')

  // Genre tags (inferred from series)
  if (track.series?.includes('Final Fantasy')) tags.push('rpg')
  if (track.series?.includes('Mario')) tags.push('platformer')

  return tags
}
```

## Process Logic

```typescript
async function runScore(db: D1Database): Promise<ScoreOutput> {
  const tracks = await db.prepare(`
    SELECT * FROM tracks_normalized WHERE guard_status = 'approved'
  `).all()

  const scores = []

  for (const track of tracks.results) {
    const difficulty = calculateDifficulty(track)
    const notability = calculateNotability(track)
    const quality = calculateQuality(track)
    const tags = generateTags(track, { difficulty, notability })

    await db.prepare(`
      INSERT INTO scores (track_id, difficulty, notability, quality, tags)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(track_id) DO UPDATE SET
        difficulty = excluded.difficulty,
        notability = excluded.notability,
        quality = excluded.quality,
        tags = excluded.tags,
        updated_at = CURRENT_TIMESTAMP
    `).bind(track.track_id, difficulty, notability, quality, JSON.stringify(tags)).run()

    scores.push({ track_id: track.track_id, difficulty, notability, quality, tags })
  }

  return { scores }
}
```

## Future Enhancements (Phase 2+)

### Acoustic Scoring

```typescript
// Phase 2: Add BPM, tempo changes
function calculateAcousticDifficulty(features: AudioFeatures): number {
  let score = 0
  if (features.bpm > 180) score += 10 // Fast tempo = harder
  if (features.tempo_changes > 3) score += 15 // Complex tempo = harder
  return score
}
```

### Behavioral Scoring

```typescript
// Phase 3: Adjust based on user performance
async function adjustScoreFromBehavior(
  db: D1Database,
  trackId: number
): Promise<void> {
  const stats = await db.prepare(`
    SELECT AVG(correct) as accuracy FROM metrics
    WHERE question_id = ? AND event_type = 'answer_submit'
  `).bind(trackId).first()

  // If accuracy < 30%, increase difficulty
  // If accuracy > 70%, decrease difficulty
  const adjustment = (stats.accuracy - 0.5) * 40
  await db.prepare(`
    UPDATE scores SET difficulty = difficulty - ? WHERE track_id = ?
  `).bind(adjustment, trackId).run()
}
```

## Idempotency

- **Key**: `track_id` (UPSERT)
- **Behavior**: 既存スコアがあれば更新、なければ挿入

## Next Stage

Score 完了後、Publish ステージが scores を使って問題選定。
