# Guard Stage – Pipeline

- **Status**: Draft
- **Last Updated**: 2025-10-10

## Purpose

クイズに適さない楽曲を品質・ポリシーで検証し、フィルタリング。

## Phase Implementation

| Phase | Validation |
|-------|-----------|
| **1 (MVP)** | 手動検証済み (全て approved) |
| **2** | ルールベース (必須フィールド、ブラックリストワード) |
| **3** | + ML 品質判定 (音質、ノイズ) |

## Input

```typescript
interface GuardInput {
  tracks: {
    track_id: number
    title: string
    game: string
    composer?: string
    year?: number
    length_sec?: number
  }[]
}
```

## Output

```typescript
interface GuardOutput {
  approved: number
  rejected: number
  pending: number
  results: {
    track_id: number
    guard_status: 'approved' | 'rejected' | 'pending'
    reasons?: string[]
  }[]
}
```

## Validation Rules (Phase 2)

### 1. Required Fields

```typescript
const REQUIRED_FIELDS = ['title', 'game', 'composer', 'year']

function checkRequiredFields(track: Track): { ok: boolean; missing: string[] } {
  const missing = REQUIRED_FIELDS.filter((field) => !track[field])
  return { ok: missing.length === 0, missing }
}
```

### 2. Blacklist Keywords

```typescript
const BLACKLIST = [
  /unreleased/i,
  /demo/i,
  /beta/i,
  /unused/i,
  /placeholder/i,
]

function checkBlacklist(track: Track): { ok: boolean; matched?: string } {
  for (const pattern of BLACKLIST) {
    if (pattern.test(track.title)) {
      return { ok: false, matched: pattern.source }
    }
  }
  return { ok: true }
}
```

### 3. Length Constraints

```typescript
const MIN_LENGTH_SEC = 30
const MAX_LENGTH_SEC = 600

function checkLength(track: Track): { ok: boolean; reason?: string } {
  if (!track.length_sec) return { ok: true } // Skip if unknown
  if (track.length_sec < MIN_LENGTH_SEC) {
    return { ok: false, reason: 'too_short' }
  }
  if (track.length_sec > MAX_LENGTH_SEC) {
    return { ok: false, reason: 'too_long' }
  }
  return { ok: true }
}
```

## Process Logic (Phase 2)

```typescript
async function runGuard(db: D1Database): Promise<GuardOutput> {
  const tracks = await db.prepare(`
    SELECT * FROM tracks_normalized WHERE guard_status = 'pending'
  `).all()

  const results = []

  for (const track of tracks.results) {
    const reasons = []

    // Check 1: Required fields
    const fieldsCheck = checkRequiredFields(track)
    if (!fieldsCheck.ok) {
      reasons.push(`missing_fields:${fieldsCheck.missing.join(',')}`)
    }

    // Check 2: Blacklist
    const blacklistCheck = checkBlacklist(track)
    if (!blacklistCheck.ok) {
      reasons.push(`blacklisted:${blacklistCheck.matched}`)
    }

    // Check 3: Length
    const lengthCheck = checkLength(track)
    if (!lengthCheck.ok) {
      reasons.push(lengthCheck.reason)
    }

    // Determine status
    const status = reasons.length > 0 ? 'rejected' : 'approved'

    // Update DB
    await db.prepare(`
      UPDATE tracks_normalized
      SET guard_status = ?
      WHERE track_id = ?
    `).bind(status, track.track_id).run()

    results.push({ track_id: track.track_id, guard_status: status, reasons })
  }

  return {
    approved: results.filter((r) => r.guard_status === 'approved').length,
    rejected: results.filter((r) => r.guard_status === 'rejected').length,
    pending: 0,
    results,
  }
}
```

## Idempotency

- **Key**: `track_id` で一意
- **Behavior**: 同じ `guard_status` なら更新スキップ

## Next Stage

Guard 完了後、Dedup ステージが `guard_status='approved'` の楽曲を処理。
