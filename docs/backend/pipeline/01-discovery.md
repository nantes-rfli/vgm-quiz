# Discovery Stage – Pipeline

- **Status**: Draft
- **Last Updated**: 2025-10-10

## Purpose

外部ソースから楽曲 ID/URL リストを取得。メタデータや音源は取得せず、リスト作成のみ。

## Phase Implementation

| Phase | Source | Method |
|-------|--------|--------|
| **1 (MVP)** | `curated.json` | ローカル JSON ファイル読み込み |
| **2** | Spotify API | Playlist/Album API |
| **3** | + YouTube API | Channel/Playlist API |

## Input

```typescript
interface DiscoveryInput {
  sources: {
    type: 'manual' | 'spotify_playlist' | 'youtube_channel'
    url?: string          // API endpoint or file path
    credentials?: {       // Phase 2+
      client_id: string
      client_secret: string
    }
    cursor?: string       // Pagination token
  }[]
}
```

## Output

```typescript
interface DiscoveryOutput {
  items_discovered: number
  items: {
    source_id: number       // FK to sources table
    external_id: string     // e.g., "spotify:track:abc123"
    url: string             // API URL or direct link
    priority: number        // 1-10 (higher = process first)
    discovered_at: string   // ISO timestamp
  }[]
}
```

## Storage

### D1 Tables

```sql
-- Source configuration
CREATE TABLE sources (
  source_id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,             -- 'manual' | 'spotify_playlist' | 'youtube_channel'
  url TEXT,                       -- API endpoint or file path
  auth_key TEXT,                  -- Encrypted credentials
  rate_limit INTEGER DEFAULT 100, -- Requests per minute
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Discovery results
CREATE TABLE discovery_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id INTEGER NOT NULL,
  external_id TEXT NOT NULL,
  url TEXT NOT NULL,
  priority INTEGER DEFAULT 5,
  discovered_at TIMESTAMP NOT NULL,
  status TEXT DEFAULT 'pending',  -- 'pending' | 'harvested' | 'failed'
  UNIQUE(source_id, external_id),
  FOREIGN KEY(source_id) REFERENCES sources(source_id)
);

CREATE INDEX idx_discovery_status ON discovery_items(status, priority DESC);
```

## Process Logic

### Phase 1: Manual JSON

```typescript
async function discoverFromManualJSON(db: D1Database, filePath: string): Promise<DiscoveryOutput> {
  const json = await readFile(filePath) // e.g., workers/data/curated.json
  const tracks = json.tracks

  const items = tracks.map((track, index) => ({
    source_id: 1, // Manual source
    external_id: `manual:${track.id || index}`,
    url: track.url || '',
    priority: track.priority || 5,
    discovered_at: new Date().toISOString(),
  }))

  // Insert into D1 (UPSERT)
  for (const item of items) {
    await db
      .prepare(`
        INSERT INTO discovery_items (source_id, external_id, url, priority, discovered_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(source_id, external_id) DO UPDATE SET
          url = excluded.url,
          priority = excluded.priority,
          discovered_at = excluded.discovered_at
      `)
      .bind(item.source_id, item.external_id, item.url, item.priority, item.discovered_at)
      .run()
  }

  return { items_discovered: items.length, items }
}
```

### Phase 2: Spotify API

```typescript
async function discoverFromSpotify(
  db: D1Database,
  playlistId: string,
  credentials: { client_id: string; client_secret: string }
): Promise<DiscoveryOutput> {
  // 1. Get access token
  const token = await getSpotifyAccessToken(credentials)

  // 2. Fetch playlist tracks
  const response = await fetch(
    `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=50`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const data = await response.json()

  // 3. Map to discovery_items
  const items = data.items.map((item) => ({
    source_id: 2, // Spotify source
    external_id: `spotify:track:${item.track.id}`,
    url: item.track.href,
    priority: 5,
    discovered_at: new Date().toISOString(),
  }))

  // 4. Insert into D1
  // ... (same as Phase 1)

  return { items_discovered: items.length, items }
}
```

## Idempotency

- **Key**: `source_id + external_id` の UNIQUE 制約
- **Behavior**: 既存レコードがあれば UPDATE、なければ INSERT (UPSERT)
- **Input Hash**: Source config + cursor で計算し、`audits` テーブルに記録

## Error Handling

| Error | Action |
|-------|--------|
| **API timeout** | 指数バックオフで3回リトライ |
| **Invalid credentials** | `audits.ok=false` 記録、早期終了 |
| **Rate limit exceeded** | 次回 Cron まで待機 |
| **Partial success** | 成功分のみコミット、`status=partial` |

## Monitoring

- **Metrics**: `items_discovered`, execution time, error rate
- **Logs**: `wrangler tail pipeline` で確認
- **Audits**: `audits` テーブルで履歴追跡

## Next Stage

Discovery 完了後、Harvest ステージが `discovery_items` を読み取ってメタデータ取得を開始。
