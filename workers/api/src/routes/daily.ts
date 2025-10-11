import { getTodayJST, isValidDateFormat } from '../../../shared/lib/date'
import type { Env } from '../../../shared/types/env'
import { fetchDailyQuestions } from '../lib/daily'

/**
 * GET /daily - Return daily question set
 */
export async function handleDailyRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const date = url.searchParams.get('date') || getTodayJST()

  // Validate date format
  if (!isValidDateFormat(date)) {
    return new Response(
      JSON.stringify({ error: 'Invalid date format', message: 'Use YYYY-MM-DD' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  // Fetch from R2 or D1
  const daily = await fetchDailyQuestions(env, date)

  if (!daily) {
    return new Response(
      JSON.stringify({ error: 'Not found', message: `No question set for ${date}` }),
      { status: 404, headers: { 'Content-Type': 'application/json' } },
    )
  }

  return new Response(JSON.stringify(daily), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
