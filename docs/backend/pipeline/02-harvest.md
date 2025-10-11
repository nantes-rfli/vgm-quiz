# Harvest Stage – Pipeline

- **Status**: Draft
- **Last Updated**: 2025-10-10

## Purpose

Discovery で取得した外部 ID からメタデータを取得し、正規化して D1 に保存。

## Phase Implementation

| Phase | Method | Audio |
|-------|--------|-------|
| **1 (MVP)** | curated.json から直接読み込み | なし |
| **2** | Spotify API でメタデータ取得 | URL のみ保存 |
| **3** | + 音源ファイル DL → R2 | 特徴量抽出 |

## Input

```typescript
interface HarvestInput {
  discovery_items: {
    id: number
    external_id: string
    url: string
  }[]
}
```

## Output

```typescript
interface HarvestOutput {
  tracks_normalized: {
    track_id: number
    title: string
    game: string
    series: string
    composer: string
    platform: string
    year: number
    length_sec: number
    external_ids: string  // JSON
    guard_status: 'pending'
  }[]
}
```

## Storage

### D1 Tables

- `tracks_normalized`: メタデータ格納
- `raw_blobs` (Phase 2+): R2 キーへの参照

## Process Logic (Phase 1)

```typescript
async function harvestFromJSON(db: D1Database, items: DiscoveryItem[]): Promise<void> {
  for (const item of items) {
    // curated.json の構造に合わせて読み込み
    const track = parseTrackFromJSON(item)

    await db.prepare(`
      INSERT INTO tracks_normalized (title, game, series, composer, platform, year, guard_status)
      VALUES (?, ?, ?, ?, ?, ?, 'approved')
    `).bind(
      track.title,
      track.game,
      track.series,
      track.composer,
      track.platform,
      track.year
    ).run()

    // discovery_items.status を 'harvested' に更新
    await db.prepare(`
      UPDATE discovery_items SET status = 'harvested' WHERE id = ?
    `).bind(item.id).run()
  }
}
```

## Idempotency

- **Key**: `external_id` の UNIQUE 制約で重複挿入を防止
- **Behavior**: 既存レコードがあれば UPDATE (Phase 2+)

## Error Handling

| Error | Action |
|-------|--------|
| **Invalid JSON** | `audits.ok=false` 記録、スキップ |
| **Missing required field** | `guard_status='rejected'` で保存 |
| **API timeout** (Phase 2) | 指数バックオフで3回リトライ |

## Next Stage

Harvest 完了後、Guard ステージが `tracks_normalized` を検証。
