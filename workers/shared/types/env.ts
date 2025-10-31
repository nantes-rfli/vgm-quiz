export interface Env {
  DB: D1Database
  STORAGE: R2Bucket
  JWT_SECRET: string // Secret key for JWS token signing (Phase 2B)
}
