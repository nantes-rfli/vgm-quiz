import type { D1Database } from '@cloudflare/workers-types'
import { getManifest } from '../../../shared/data/manifest'
import type { Env } from '../../../shared/types/env'

interface FilterOptions {
  difficulty?: string[]
  era?: string[]
  series?: string[]
}

interface AvailabilityRequest {
  mode: string
  filters?: unknown
}

/**
 * Validate and normalize filter options
 * Ensures each filter facet is an array; returns null if validation fails
 */
function validateFilters(filters: unknown): FilterOptions | null {
  if (!filters || typeof filters !== 'object') {
    return {}
  }

  const result: FilterOptions = {}
  const obj = filters as Record<string, unknown>

  // Validate difficulty filter
  if ('difficulty' in obj) {
    if (!Array.isArray(obj.difficulty)) {
      return null // Invalid: not an array
    }
    result.difficulty = obj.difficulty as string[]
  }

  // Validate era filter
  if ('era' in obj) {
    if (!Array.isArray(obj.era)) {
      return null // Invalid: not an array
    }
    result.era = obj.era as string[]
  }

  // Validate series filter
  if ('series' in obj) {
    if (!Array.isArray(obj.series)) {
      return null // Invalid: not an array
    }
    result.series = obj.series as string[]
  }

  return result
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
  if (
    filters?.difficulty &&
    filters.difficulty.length > 0 &&
    !filters.difficulty.includes('mixed')
  ) {
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

    const manifest = getManifest(env)

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

    // Validate and normalize filters
    const validatedFilters = validateFilters(body.filters)
    if (validatedFilters === null) {
      return new Response(
        JSON.stringify({
          error: {
            code: 'bad_request',
            message: 'filters must be an object with array-valued facets (difficulty, era, series)',
            details: { pointer: '/filters' },
          },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const modeExists = manifest.modes.some((mode) => mode.id === body.mode)
    if (!modeExists) {
      return new Response(
        JSON.stringify({
          error: {
            code: 'not_found',
            message: `mode ${body.mode} not found`,
            details: { pointer: '/mode' },
          },
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // Count available tracks
    const available = await countAvailableTracks(env.DB, validatedFilters)

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
