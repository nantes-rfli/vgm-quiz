import type { Env } from '../../../shared/types/env'
import type { DailyExport } from '../../../shared/types/export'

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
