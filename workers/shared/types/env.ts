export interface Env {
  DB: D1Database
  STORAGE: R2Bucket
  JWT_SECRET: string // Secret key for JWS token signing (Phase 2B)
  /** Optional prefix for storing canonical daily backups (defaults to backups/daily) */
  BACKUP_PREFIX?: string
  /** Number of days to keep backups (defaults to 14) */
  BACKUP_EXPORT_DAYS?: string
  /** Phase 4A intake flag: when truthy, run intake/discovery of external sources */
  INTAKE_ENABLED?: string
  /** Intake stage: staging | production (staging by default) */
  INTAKE_STAGE?: string
  /** JSON string of source catalog (see docs/data/source-catalog.md) */
  SOURCE_CATALOG_JSON?: string
  /** API keys for external sources */
  YOUTUBE_API_KEY?: string
  SPOTIFY_CLIENT_ID?: string
  SPOTIFY_CLIENT_SECRET?: string
  SPOTIFY_ENABLED?: string
  SPOTIFY_MARKET?: string
  APPLE_ENABLED?: string
  APPLE_MUSIC_TOKEN?: string
  APPLE_STOREFRONT?: string
  /** Run production guard eval in parallel (non-blocking) */
  INTAKE_EVAL_PROD?: string
  /**
   * Observability feature flag. When falsey, structured logging remains local
   * and external pushes (Slack/Loki) are skipped.
   */
  OBS_ENABLED?: string
  /** Optional Slack incoming webhook URL for ops notifications */
  OBS_SLACK_WEBHOOK_URL?: string
  /** Optional service/stack label for observability payloads */
  OBS_SERVICE?: string
  /** Feature flag: enable composer mode + adaptive gameplay (Phase 4B) */
  COMPOSER_MODE_ENABLED?: string
  /** A/B treatment ratio for gameplay experiments (0-100, default 50) */
  AB_TREATMENT_RATIO?: string
}
