-- Up migration: add track facets table with validation + indexes
CREATE TABLE IF NOT EXISTS track_facets (
  track_id INTEGER PRIMARY KEY,
  difficulty TEXT CHECK(difficulty IN ('easy', 'normal', 'hard')),
  genres TEXT NOT NULL DEFAULT '[]',
  series_tags TEXT NOT NULL DEFAULT '[]',
  era TEXT CHECK(era IN ('80s', '90s', '00s', '10s', '20s')),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY(track_id) REFERENCES tracks_normalized(track_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_facets_difficulty ON track_facets(difficulty);
CREATE INDEX IF NOT EXISTS idx_facets_era ON track_facets(era);

-- Down migration reference:
-- DROP INDEX IF EXISTS idx_facets_era;
-- DROP INDEX IF EXISTS idx_facets_difficulty;
-- DROP TABLE IF EXISTS track_facets;
