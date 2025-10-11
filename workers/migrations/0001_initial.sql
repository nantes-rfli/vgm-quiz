-- Create sources table
CREATE TABLE sources (
  source_id INTEGER PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'manual',
  enabled BOOLEAN DEFAULT true
);

-- Insert default manual source
INSERT INTO sources (source_id, type, enabled) VALUES (1, 'manual', true);

-- Create tracks_normalized table
CREATE TABLE tracks_normalized (
  track_id INTEGER PRIMARY KEY AUTOINCREMENT,
  external_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  game TEXT NOT NULL,
  series TEXT,
  composer TEXT,
  platform TEXT,
  year INTEGER,
  youtube_url TEXT,
  spotify_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create pool table
CREATE TABLE pool (
  track_id INTEGER PRIMARY KEY,
  state TEXT DEFAULT 'available',
  cooldown_until TIMESTAMP,
  last_picked_at TIMESTAMP,
  times_picked INTEGER DEFAULT 0,
  FOREIGN KEY(track_id) REFERENCES tracks_normalized(track_id)
);

CREATE INDEX idx_pool_state ON pool(state, cooldown_until);

-- Create picks table
CREATE TABLE picks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  items TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_picks_date ON picks(date);

-- Create exports table
CREATE TABLE exports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  r2_key TEXT NOT NULL,
  version TEXT NOT NULL,
  hash TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_exports_date ON exports(date);
