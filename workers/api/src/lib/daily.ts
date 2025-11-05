import { getTodayJST } from '../../../shared/lib/date'
import { CANONICAL_FILTER_KEY, buildExportR2Key } from '../../../shared/lib/filters'
import type { Env } from '../../../shared/types/env'
import type { DailyExport } from '../../../shared/types/export'
import type { Phase2TokenPayload } from './token'

/**
 * Fetch question export by date and filter key
 */
export async function fetchRoundExport(
  env: Env,
  date: string,
  filterKey: string,
): Promise<DailyExport | null> {
  // 1. Try R2 first (cache hit)
  const r2Key = buildExportR2Key(date, filterKey)
  const obj = await env.STORAGE.get(r2Key)

  if (obj) {
    try {
      const text = await obj.text()
      return JSON.parse(text) as DailyExport
    } catch (error) {
      console.error('[RoundExport] Failed to parse R2 JSON', { date, filterKey, error })
      return null
    }
  }

  // 2. Fallback: Try D1 picks table
  const pick = await env.DB.prepare('SELECT items FROM picks WHERE date = ? AND filters_json = ?')
    .bind(date, filterKey)
    .first<{ items: string }>()

  if (pick) {
    try {
      return JSON.parse(pick.items) as DailyExport
    } catch (error) {
      console.error('[RoundExport] Failed to parse picks JSON', { date, filterKey, error })
      return null
    }
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
  const filterKey = token.filtersKey ?? CANONICAL_FILTER_KEY

  // Use explicit date if token provides it (preferred), otherwise derive from issued-at timestamp
  let date = token.date
  if (!date) {
    const iatMs = token.iat * 1000
    const jstOffsetMs = 9 * 60 * 60 * 1000
    const jstDate = new Date(iatMs + jstOffsetMs)
    date = jstDate.toISOString().split('T')[0]
  }

  if (!date) {
    date = getTodayJST()
  }

  const exportData = await fetchRoundExport(env, date, filterKey)

  if (exportData) {
    return exportData
  }

  // Fallback: attempt canonical daily data for the same date, then today's canonical set
  const canonical = await fetchRoundExport(env, date, CANONICAL_FILTER_KEY)
  if (canonical) {
    return canonical
  }

  const todayJST = getTodayJST()
  return fetchRoundExport(env, todayJST, CANONICAL_FILTER_KEY)
}

export async function fetchDailyQuestions(env: Env, date: string): Promise<DailyExport | null> {
  return fetchRoundExport(env, date, CANONICAL_FILTER_KEY)
}
