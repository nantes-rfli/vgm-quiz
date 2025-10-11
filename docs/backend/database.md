# Database Schema – vgm-quiz Backend

- **Status**: Draft
- **Last Updated**: 2025-10-10

## Overview

D1 (Cloudflare の SQLite ベース DB) を使用。全テーブルを1つの DB に配置。

## ER Diagram

```
sources
  ↓ (1:N)
discovery_items
  ↓ (1:1)
tracks_normalized ←──┐
  ↓ (1:1)            │
clusters             │
  ↓ (1:1)            │
scores               │
  ↓ (1:1)            │
pool                 │
  ↓ (N:1)            │
picks ───────────────┘

audits (standalone)
exports (standalone)
```

## Table Definitions

### 1. sources

```sql
CREATE TABLE sources (
  source_id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,             -- 'manual' | 'spotify_playlist' | 'youtube_channel'
  url TEXT,                       -- API endpoint or file path
  auth_key TEXT,                  -- Encrypted credentials (wrangler secret)
  rate_limit INTEGER DEFAULT 100, -- Requests per minute
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sources_enabled ON sources(enabled);
```

### 2. discovery_items

```sql
CREATE TABLE discovery_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id INTEGER NOT NULL,
  external_id TEXT NOT NULL,      -- e.g., "spotify:track:abc123"
  url TEXT NOT NULL,              -- API URL or direct link
  priority INTEGER DEFAULT 5,     -- 1-10 (higher = process first)
  discovered_at TIMESTAMP NOT NULL,
  status TEXT DEFAULT 'pending',  -- 'pending' | 'harvested' | 'failed'
  UNIQUE(source_id, external_id),
  FOREIGN KEY(source_id) REFERENCES sources(source_id)
);

CREATE INDEX idx_discovery_status ON discovery_items(status, priority DESC);
```

### 3. raw_blobs (Phase 2+)

```sql
CREATE TABLE raw_blobs (
  blob_id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id INTEGER NOT NULL,
  external_id TEXT NOT NULL,
  r2_key TEXT NOT NULL,           -- R2 object key (e.g., "blobs/abc123.mp3")
  fetched_at TIMESTAMP NOT NULL,
  UNIQUE(source_id, external_id),
  FOREIGN KEY(source_id) REFERENCES sources(source_id)
);
```

### 4. tracks_normalized

```sql
CREATE TABLE tracks_normalized (
  track_id INTEGER PRIMARY KEY AUTOINCREMENT,
  cluster_id INTEGER,             -- NULL if not clustered yet
  title TEXT NOT NULL,
  game TEXT NOT NULL,
  series TEXT,                    -- e.g., "Final Fantasy"
  composer TEXT,
  platform TEXT,                  -- e.g., "SNES"
  year INTEGER,
  length_sec INTEGER,
  external_ids TEXT,              -- JSON: {"spotify": "...", "youtube": "..."}
  guard_status TEXT DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(cluster_id) REFERENCES clusters(cluster_id)
);

CREATE INDEX idx_tracks_guard ON tracks_normalized(guard_status);
CREATE INDEX idx_tracks_series ON tracks_normalized(series);
```

> Note: D1(SQlite) では `tracks_normalized.cluster_id` と `clusters.canonical_track_id` の循環参照により双方向 `FOREIGN KEY` を張れないため、実際のマイグレーションでは `cluster_id` の外部キー制約を省略し、アプリケーション側で整合性チェックを行う。

### 5. audio_features (Phase 2+)

```sql
CREATE TABLE audio_features (
  track_id INTEGER PRIMARY KEY,
  fingerprint TEXT,               -- Chromaprint hash
  bpm REAL,
  loudness REAL,
  intro_signature TEXT,           -- First 8 seconds spectral hash
  spectral_stats TEXT,            -- JSON: {"centroid": ..., "rolloff": ...}
  FOREIGN KEY(track_id) REFERENCES tracks_normalized(track_id)
);
```

### 6. clusters

```sql
CREATE TABLE clusters (
  cluster_id INTEGER PRIMARY KEY AUTOINCREMENT,
  canonical_track_id INTEGER NOT NULL, -- Representative track
  variant_track_ids TEXT NOT NULL,     -- JSON array of variant IDs
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(canonical_track_id) REFERENCES tracks_normalized(track_id)
);

CREATE INDEX idx_clusters_canonical ON clusters(canonical_track_id);
```

### 7. scores

```sql
CREATE TABLE scores (
  track_id INTEGER PRIMARY KEY,
  difficulty INTEGER NOT NULL,    -- 0-100
  notability INTEGER NOT NULL,    -- 0-100
  quality INTEGER NOT NULL,       -- 0-100
  tags TEXT,                      -- JSON: ["easy", "popular", "rpg"]
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(track_id) REFERENCES tracks_normalized(track_id)
);

CREATE INDEX idx_scores_difficulty ON scores(difficulty);
CREATE INDEX idx_scores_notability ON scores(notability);
```

### 8. pool

```sql
CREATE TABLE pool (
  track_id INTEGER PRIMARY KEY,
  state TEXT DEFAULT 'available',  -- 'available' | 'cooldown'
  cooldown_until TIMESTAMP,
  last_picked_at TIMESTAMP,
  times_picked INTEGER DEFAULT 0,
  tags TEXT,                       -- JSON: ["easy", "popular", "rpg"]
  FOREIGN KEY(track_id) REFERENCES tracks_normalized(track_id)
);

CREATE INDEX idx_pool_state ON pool(state, cooldown_until);
```

### 9. picks

```sql
CREATE TABLE picks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,       -- YYYY-MM-DD
  items TEXT NOT NULL,             -- JSON array of question objects
  status TEXT DEFAULT 'pending',   -- 'pending' | 'exported' | 'failed'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_picks_date ON picks(date);
```

### 10. exports

```sql
CREATE TABLE exports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,       -- YYYY-MM-DD
  r2_key TEXT NOT NULL,            -- R2 object key
  version TEXT NOT NULL,           -- Semantic version
  hash TEXT NOT NULL,              -- SHA-256 of JSON
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_exports_date ON exports(date);
```

### 11. audits

```sql
CREATE TABLE audits (
  job_id TEXT PRIMARY KEY,         -- UUID
  stage TEXT NOT NULL,             -- "discovery" | "harvest" | ...
  input_hash TEXT NOT NULL,        -- SHA-256 of input
  output_hash TEXT,                -- SHA-256 of output (null if failed)
  ok BOOLEAN NOT NULL,             -- Success/failure
  reasons TEXT,                    -- JSON: error reasons (if failed)
  started_at TIMESTAMP NOT NULL,
  finished_at TIMESTAMP
);

CREATE INDEX idx_audits_stage_hash ON audits(stage, input_hash);
CREATE INDEX idx_audits_ok ON audits(ok, started_at);
```

## Migrations

### Migration File Structure

```
workers/migrations/
├── 0001_initial.sql        # sources, discovery_items, tracks_normalized
├── 0002_clusters.sql       # clusters, scores
├── 0003_pool.sql           # pool, picks, exports
├── 0004_audits.sql         # audits
└── 0005_audio_features.sql # audio_features (Phase 2)
```

### Example Migration (0001_initial.sql)

```sql
-- Create sources table
CREATE TABLE sources (
  source_id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  url TEXT,
  auth_key TEXT,
  rate_limit INTEGER DEFAULT 100,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create discovery_items table
CREATE TABLE discovery_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id INTEGER NOT NULL,
  external_id TEXT NOT NULL,
  url TEXT NOT NULL,
  priority INTEGER DEFAULT 5,
  discovered_at TIMESTAMP NOT NULL,
  status TEXT DEFAULT 'pending',
  UNIQUE(source_id, external_id),
  FOREIGN KEY(source_id) REFERENCES sources(source_id)
);

CREATE INDEX idx_discovery_status ON discovery_items(status, priority DESC);

-- Create tracks_normalized table
CREATE TABLE tracks_normalized (
  track_id INTEGER PRIMARY KEY AUTOINCREMENT,
  cluster_id INTEGER,
  title TEXT NOT NULL,
  game TEXT NOT NULL,
  series TEXT,
  composer TEXT,
  platform TEXT,
  year INTEGER,
  length_sec INTEGER,
  external_ids TEXT,
  guard_status TEXT DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_tracks_guard ON tracks_normalized(guard_status);
CREATE INDEX idx_tracks_series ON tracks_normalized(series);

-- Insert default manual source
INSERT INTO sources (source_id, type, url, enabled)
VALUES (1, 'manual', 'file://workers/data/curated.json', true);
```

### Applying Migrations

```bash
cd workers

# Apply all pending migrations
wrangler d1 migrations apply vgm-quiz-db

# Apply to local dev DB
wrangler d1 migrations apply vgm-quiz-db --local

# List migration status
wrangler d1 migrations list vgm-quiz-db
```

## Seed Data (Phase 1)

```sql
-- workers/migrations/seed.sql

-- Sample curated track
INSERT INTO discovery_items (source_id, external_id, url, priority, discovered_at, status)
VALUES (1, 'manual:001', 'https://youtube.com/watch?v=example', 10, datetime('now'), 'pending');

INSERT INTO tracks_normalized (title, game, series, composer, platform, year, guard_status)
VALUES ('Green Hill Zone', 'Sonic the Hedgehog', 'Sonic', 'Masato Nakamura', 'Genesis', 1991, 'approved');
```

## Query Examples

### Get Available Tracks for Picking

```sql
SELECT p.track_id, t.title, t.game, s.difficulty, s.notability
FROM pool p
JOIN tracks_normalized t ON p.track_id = t.track_id
JOIN scores s ON p.track_id = s.track_id
WHERE p.state = 'available'
  AND (p.cooldown_until IS NULL OR p.cooldown_until < datetime('now'))
ORDER BY s.difficulty ASC, s.notability DESC
LIMIT 20;
```

### Check Audit History for a Stage

```sql
SELECT job_id, ok, started_at, finished_at, reasons
FROM audits
WHERE stage = 'discovery'
  AND started_at > datetime('now', '-7 days')
ORDER BY started_at DESC;
```

### Get Export Metadata

```sql
SELECT e.date, e.r2_key, e.version, e.hash, p.status
FROM exports e
JOIN picks p ON e.date = p.date
WHERE e.date = '2025-10-10';
```

## Storage Estimates

| Table | Rows (Phase 1) | Rows (Phase 2) | Size Estimate |
|-------|----------------|----------------|---------------|
| **sources** | 1 | 10 | ~1 KB |
| **discovery_items** | 100 | 10,000 | ~500 KB |
| **tracks_normalized** | 100 | 10,000 | ~2 MB |
| **clusters** | 0 | 1,000 | ~50 KB |
| **scores** | 100 | 10,000 | ~500 KB |
| **pool** | 100 | 10,000 | ~300 KB |
| **picks** | 365 | 365 | ~50 MB (JSON) |
| **exports** | 365 | 365 | ~10 KB |
| **audits** | 1,000 | 100,000 | ~10 MB |
| **Total** | - | - | **~65 MB** |

D1 無料枠 (5GB) で十分。
