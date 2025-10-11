-- vgm-quiz D1 schema (initial migration)
-- Generated from docs/backend/database.md on 2025-10-10
-- Execute via `wrangler d1 migrations apply` or equivalent

BEGIN TRANSACTION;

CREATE TABLE IF NOT EXISTS sources (
  source_id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  url TEXT,
  auth_key TEXT,
  rate_limit INTEGER DEFAULT 100,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sources_enabled ON sources(enabled);

CREATE TABLE IF NOT EXISTS discovery_items (
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

CREATE INDEX IF NOT EXISTS idx_discovery_status
  ON discovery_items(status, priority DESC);

CREATE TABLE IF NOT EXISTS raw_blobs (
  blob_id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id INTEGER NOT NULL,
  external_id TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  fetched_at TIMESTAMP NOT NULL,
  UNIQUE(source_id, external_id),
  FOREIGN KEY(source_id) REFERENCES sources(source_id)
);

CREATE TABLE IF NOT EXISTS tracks_normalized (
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

-- NOTE: Circular FK (cluster_id ↔ canonical_track_id) is enforced in application logic.

CREATE INDEX IF NOT EXISTS idx_tracks_guard
  ON tracks_normalized(guard_status);
CREATE INDEX IF NOT EXISTS idx_tracks_series
  ON tracks_normalized(series);

CREATE TABLE IF NOT EXISTS clusters (
  cluster_id INTEGER PRIMARY KEY AUTOINCREMENT,
  canonical_track_id INTEGER NOT NULL,
  variant_track_ids TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(canonical_track_id) REFERENCES tracks_normalized(track_id)
);

CREATE INDEX IF NOT EXISTS idx_clusters_canonical
  ON clusters(canonical_track_id);

CREATE TABLE IF NOT EXISTS audio_features (
  track_id INTEGER PRIMARY KEY,
  fingerprint TEXT,
  bpm REAL,
  loudness REAL,
  intro_signature TEXT,
  spectral_stats TEXT,
  FOREIGN KEY(track_id) REFERENCES tracks_normalized(track_id)
);

CREATE TABLE IF NOT EXISTS scores (
  track_id INTEGER PRIMARY KEY,
  difficulty INTEGER NOT NULL,
  notability INTEGER NOT NULL,
  quality INTEGER NOT NULL,
  tags TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(track_id) REFERENCES tracks_normalized(track_id)
);

CREATE INDEX IF NOT EXISTS idx_scores_difficulty
  ON scores(difficulty);
CREATE INDEX IF NOT EXISTS idx_scores_notability
  ON scores(notability);

CREATE TABLE IF NOT EXISTS pool (
  track_id INTEGER PRIMARY KEY,
  state TEXT DEFAULT 'available',
  cooldown_until TIMESTAMP,
  last_picked_at TIMESTAMP,
  times_picked INTEGER DEFAULT 0,
  tags TEXT,
  FOREIGN KEY(track_id) REFERENCES tracks_normalized(track_id)
);

CREATE INDEX IF NOT EXISTS idx_pool_state
  ON pool(state, cooldown_until);

CREATE TABLE IF NOT EXISTS picks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  items TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_picks_date ON picks(date);

CREATE TABLE IF NOT EXISTS exports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  r2_key TEXT NOT NULL,
  version TEXT NOT NULL,
  hash TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_exports_date ON exports(date);

CREATE TABLE IF NOT EXISTS audits (
  job_id TEXT PRIMARY KEY,
  stage TEXT NOT NULL,
  input_hash TEXT NOT NULL,
  output_hash TEXT,
  ok BOOLEAN NOT NULL,
  reasons TEXT,
  started_at TIMESTAMP NOT NULL,
  finished_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audits_stage_hash
  ON audits(stage, input_hash);

COMMIT;
