import { getTodayJST, isValidDateFormat } from '../../../shared/lib/date'
import { logEvent } from '../../../shared/lib/observability'
import type { Env } from '../../../shared/types/env'
import { fetchBackupDaily, fetchDailyQuestions } from '../lib/daily'

/**
 * GET /daily - Return daily question set
 */
export async function handleDailyRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const date = url.searchParams.get('date') || getTodayJST()
  const backupParam = url.searchParams.get('backup')
  const backupRequested = backupParam === '1' || backupParam?.toLowerCase() === 'true'

  // Validate date format
  if (!isValidDateFormat(date)) {
    return new Response(
      JSON.stringify({ error: 'Invalid date format', message: 'Use YYYY-MM-DD' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  // Fetch from R2 or D1
  let daily = await fetchDailyQuestions(env, date)
  let source: 'primary' | 'backup' = 'primary'

  if (!daily && backupRequested) {
    daily = await fetchBackupDaily(env, date)
    if (daily) {
      source = 'backup'
      logEvent(env, 'info', {
        event: 'api.daily.backup',
        status: 'success',
        fields: { date },
        message: 'Served daily preset from backup prefix',
      })
    } else {
      logEvent(env, 'warn', {
        event: 'api.daily.backup',
        status: 'fail',
        fields: { date },
        message: 'Backup requested but export not found',
      })
    }
  }

  if (!daily) {
    const errorPayload = backupRequested
      ? { error: 'Not found', message: `No backup export for ${date}` }
      : { error: 'Not found', message: `No question set for ${date}` }
    return new Response(JSON.stringify(errorPayload), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify(daily), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
      'X-VGM-Daily-Source': source,
    },
  })
}
