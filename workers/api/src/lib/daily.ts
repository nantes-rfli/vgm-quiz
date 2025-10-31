import { getTodayJST } from '../../../shared/lib/date'
import type { Env } from '../../../shared/types/env'
import type { DailyExport } from '../../../shared/types/export'
import type { Phase2TokenPayload } from './token'

/**
 * Fetch daily questions from R2 or D1 fallback
 */
export async function fetchDailyQuestions(env: Env, date: string): Promise<DailyExport | null> {
  // 1. Try R2 first (cache hit)
  const r2Key = `exports/${date}.json`
  const obj = await env.STORAGE.get(r2Key)

  if (obj) {
    const text = await obj.text()
    return JSON.parse(text) as DailyExport
  }

  // 2. Fallback: Try D1 picks table (canonical only, filters_json='{}')
  const pick = await env.DB.prepare('SELECT items FROM picks WHERE date = ? AND filters_json = ?')
    .bind(date, '{}')
    .first<{ items: string }>()

  if (pick) {
    return JSON.parse(pick.items) as DailyExport
  }

  // 3. Not found
  return null
}

/**
 * Fetch round data by Phase 2 token
 * For Phase 2B, reconstruct round state from token and stored data
 * Phase 2 implementation: fetch from picks table using filtersHash
 * For now, fallback to canonical daily data to maintain continuity
 */
export async function fetchRoundByToken(
  env: Env,
  token: Phase2TokenPayload,
): Promise<DailyExport | null> {
  // Phase 2B: Extract date from issued timestamp in JST
  // Token.iat is Unix timestamp (UTC), but we need to get the date in JST
  // to match the daily question set that Phase 1 uses

  // Convert token.iat (Unix timestamp UTC) to JST date
  // Add 9 hours (JST offset) to UTC timestamp, then extract date in UTC representation
  // This avoids locale-dependent parsing and works correctly in any timezone
  const iatMs = token.iat * 1000
  const jstOffsetMs = 9 * 60 * 60 * 1000 // JST is UTC+9
  const jstDate = new Date(iatMs + jstOffsetMs)
  const date = jstDate.toISOString().split('T')[0]

  // For MVP, fallback to canonical daily data
  // TODO: Phase 2B full implementation would fetch from picks table:
  // SELECT items FROM picks WHERE date = ? AND filtersHash = ? LIMIT 1
  // This allows supporting multiple filtered question sets per day
  const daily = await fetchDailyQuestions(env, date)

  if (!daily) {
    // Fallback: try today's date in case token was issued just before date boundary
    // This handles edge cases where token.iat is close to JST midnight
    const todayJST = getTodayJST()
    return fetchDailyQuestions(env, todayJST)
  }

  return daily
}
