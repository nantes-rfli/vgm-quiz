export interface Env {
  DB: D1Database
  STORAGE: R2Bucket
  JWT_SECRET: string // Secret key for JWS token signing (Phase 2B)
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
