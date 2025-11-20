export interface Env {
  DB: D1Database
  STORAGE: R2Bucket
  JWT_SECRET: string // Secret key for JWS token signing (Phase 2B)
  /** Optional prefix for storing canonical daily backups (defaults to backups/daily) */
  BACKUP_PREFIX?: string
  /** Number of days to keep backups (defaults to 14) */
  BACKUP_EXPORT_DAYS?: string
  /**
   * Observability feature flag. When falsey, structured logging remains local
   * and external pushes (Slack/Loki) are skipped.
   */
  OBS_ENABLED?: string
  /** Optional Slack incoming webhook URL for ops notifications */
  OBS_SLACK_WEBHOOK_URL?: string
  /** Optional service/stack label for observability payloads */
  OBS_SERVICE?: string
}
