-- Add filter support for idempotency with filtered requests
-- Purpose: Enable filter-aware caching to prevent filtered results from clobbering canonical daily presets

-- Add filters column to picks table
ALTER TABLE picks ADD COLUMN filters_json TEXT DEFAULT '{}';

-- Create composite unique index (date, filters_json) for idempotency with filters
-- This allows multiple filtered variants per date without conflicts
CREATE UNIQUE INDEX IF NOT EXISTS idx_picks_date_filters ON picks(date, filters_json);

-- Add filters column to exports table for consistency
ALTER TABLE exports ADD COLUMN filters_json TEXT DEFAULT '{}';

-- Create composite unique index for exports
CREATE UNIQUE INDEX IF NOT EXISTS idx_exports_date_filters ON exports(date, filters_json);

-- Down migration reference:
-- DROP INDEX IF EXISTS idx_exports_date_filters;
-- DROP INDEX IF EXISTS idx_picks_date_filters;
-- ALTER TABLE exports DROP COLUMN filters_json;
-- ALTER TABLE picks DROP COLUMN filters_json;
