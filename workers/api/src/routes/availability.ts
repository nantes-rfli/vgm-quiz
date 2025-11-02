import type { D1Database } from '@cloudflare/workers-types'
import type { Env } from '../../../shared/types/env'

interface FilterOptions {
  difficulty?: string[]
  era?: string[]
  series?: string[]
}

interface AvailabilityRequest {
  mode: string
  filters?: FilterOptions
}

/**
 * Count available tracks matching the given filters
 */
async function countAvailableTracks(db: D1Database, filters?: FilterOptions): Promise<number> {
  // Build WHERE clause with optional facet filters
  const whereClauses = ['p.state = ?']
  const bindings: Array<string | number> = ['available']

  // Handle difficulty filter (array of difficulty levels)
  // "mixed" in the array means "no filtering for this facet" - skip the entire filter if present
  if (filters?.difficulty && filters.difficulty.length > 0 && !filters.difficulty.includes('mixed')) {
    const difficultyConditions = filters.difficulty.map(() => 'f.difficulty = ?').join(' OR ')
    whereClauses.push(`(${difficultyConditions})`)
    bindings.push(...filters.difficulty)
  }

  // Handle era filter (array of eras)
  // "mixed" in the array means "no filtering for this facet" - skip the entire filter if present
  if (filters?.era && filters.era.length > 0 && !filters.era.includes('mixed')) {
    const eraConditions = filters.era.map(() => 'f.era = ?').join(' OR ')
    whereClauses.push(`(${eraConditions})`)
    bindings.push(...filters.era)
  }

  // Handle series filter (array of series, stored as JSON in database)
  // "mixed" in the array means "no filtering for this facet" - skip the entire filter if present
  if (filters?.series && filters.series.length > 0 && !filters.series.includes('mixed')) {
    // For series tags (JSON array), check if the JSON string contains the series tag
    // Using LIKE pattern matching as SQLite doesn't support json_contains directly
    const seriesConditions = filters.series.map(() => 'f.series_tags LIKE ?').join(' OR ')
    whereClauses.push(`(${seriesConditions})`)
    // Use pattern: %"ff"% to match "ff" within the JSON array
    bindings.push(...filters.series.map((s) => `%"${s}"%`))
  }

  const whereClause = whereClauses.join(' AND ')
  const query = `
    SELECT COUNT(*) as count
    FROM tracks_normalized t
    INNER JOIN pool p ON t.track_id = p.track_id
    LEFT JOIN track_facets f ON f.track_id = t.track_id
    WHERE ${whereClause}
  `

  const result = await db
    .prepare(query)
    .bind(...bindings)
    .first<{ count: number }>()

  return result?.count ?? 0
}

/**
 * POST /v1/availability - Get count of available tracks for given filters
 */
export async function handleAvailabilityRequest(request: Request, env: Env): Promise<Response> {
  try {
    const body = (await request.json()) as AvailabilityRequest

    // Validate request
    if (!body.mode) {
      return new Response(
        JSON.stringify({
          error: {
            code: 'bad_request',
            message: 'mode is required',
            details: { pointer: '/mode' },
          },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // Count available tracks
    const available = await countAvailableTracks(env.DB, body.filters)

    return new Response(JSON.stringify({ available }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (error) {
    console.error('Availability API error:', error)
    return new Response(
      JSON.stringify({
        error: {
          code: 'server_error',
          message: error instanceof Error ? error.message : 'Internal server error',
        },
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
}
