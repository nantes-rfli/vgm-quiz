# Dedup Stage – Pipeline

- **Status**: Draft
- **Last Updated**: 2025-10-10

## Purpose

重複・近似楽曲を検出し、クラスタリング。代表楽曲を選定。

## Phase Implementation

| Phase | Method |
|-------|--------|
| **1 (MVP)** | スキップ (手動キュレーションで重複なし) |
| **2** | タイトル正規化 + Levenshtein 距離 |
| **3** | + 音響指紋 (Chromaprint) で完全一致検出 |

## Input

```typescript
interface DedupInput {
  tracks: {
    track_id: number
    title: string
    game: string
    series: string
  }[]
}
```

## Output

```typescript
interface DedupOutput {
  clusters_created: number
  clusters: {
    cluster_id: number
    canonical_track_id: number
    variant_track_ids: number[]
  }[]
}
```

## Deduplication Logic (Phase 2)

### 1. Title Normalization

```typescript
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ')    // Collapse whitespace
    .trim()
}
```

### 2. Similarity Check

```typescript
function levenshteinDistance(a: string, b: string): number {
  const matrix = []
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        )
      }
    }
  }
  return matrix[b.length][a.length]
}

function areSimilar(track1: Track, track2: Track): boolean {
  const norm1 = normalizeTitle(track1.title)
  const norm2 = normalizeTitle(track2.title)
  const distance = levenshteinDistance(norm1, norm2)
  const threshold = Math.max(norm1.length, norm2.length) * 0.2 // 20% difference allowed
  return distance <= threshold && track1.game === track2.game
}
```

### 3. Clustering

```typescript
async function runDedup(db: D1Database): Promise<DedupOutput> {
  const tracks = await db.prepare(`
    SELECT * FROM tracks_normalized WHERE guard_status = 'approved' AND cluster_id IS NULL
  `).all()

  const clusterRecords: DedupOutput['clusters'] = []
  const processed = new Set<number>()

  for (const track of tracks.results) {
    if (processed.has(track.track_id)) continue

    const similar = tracks.results.filter(
      (t) => t.track_id !== track.track_id && areSimilar(track, t)
    )

    if (similar.length > 0) {
      // Create cluster
      const clusterResult = await db.prepare(`
        INSERT INTO clusters (canonical_track_id, variant_track_ids)
        VALUES (?, ?)
      `).bind(track.track_id, JSON.stringify(similar.map((s) => s.track_id))).run()

      const clusterId = clusterResult.meta.last_row_id

      // Update tracks
      const trackIds = [track.track_id, ...similar.map((s) => s.track_id)]
      const placeholders = trackIds.map(() => '?').join(', ')
      await db.prepare(`
        UPDATE tracks_normalized SET cluster_id = ? WHERE track_id IN (${placeholders})
      `).bind(clusterId, ...trackIds).run()

      clusterRecords.push({
        cluster_id: clusterId,
        canonical_track_id: track.track_id,
        variant_track_ids: similar.map((s) => s.track_id),
      })

      processed.add(track.track_id)
      similar.forEach((s) => processed.add(s.track_id))
    }
  }

  return {
    clusters_created: clusterRecords.length,
    clusters: clusterRecords,
  }
}
```

## Idempotency

- **Key**: `cluster_id` で既にクラスタリング済みの楽曲はスキップ
- **Behavior**: `cluster_id IS NULL` の楽曲のみ処理

## Next Stage

Dedup 完了後、Score ステージが clusters の canonical_track を評価。
