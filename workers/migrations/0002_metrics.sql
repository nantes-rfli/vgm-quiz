-- Create metrics_events table
CREATE TABLE metrics_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  event_ts TIMESTAMP NOT NULL,
  round_id TEXT,
  question_idx INTEGER,
  attrs TEXT,
  app_version TEXT,
  tz TEXT,
  received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_metrics_client_event ON metrics_events(client_id, event_id);
CREATE INDEX idx_metrics_received_at ON metrics_events(received_at);
CREATE INDEX idx_metrics_event_name ON metrics_events(event_name);

-- Create metrics_deduplication table for 24h window
CREATE TABLE metrics_deduplication (
  client_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (client_id, event_id)
);

CREATE INDEX idx_metrics_dedup_received_at ON metrics_deduplication(received_at);
