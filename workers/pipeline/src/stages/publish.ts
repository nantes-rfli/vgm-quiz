import { generateChoices } from '../../../shared/lib/choices'
import { getTodayJST } from '../../../shared/lib/date'
import { buildExportR2Key, createFilterKey, normalizeFilters } from '../../../shared/lib/filters'
import { sha256 } from '../../../shared/lib/hash'
import type { Env } from '../../../shared/types/env'
import type { DailyExport, Question, QuestionFacets } from '../../../shared/types/export'
import type { FilterOptions } from '../../../shared/types/filters'

interface PublishResult {
  success: boolean
  skipped?: boolean // True if question set already exists (idempotency guard)
  date: string
  questionsGenerated: number
  r2Key?: string
  hash?: string
  error?: string
}

interface TrackRow {
  track_id: number
  external_id: string
  title: string
  game: string
  series: string | null
  composer: string | null
  platform: string | null
  year: number | null
  youtube_url: string | null
  spotify_url: string | null
  apple_music_url: string | null
  difficulty: string | null
  genres: string | null
  series_tags: string | null
  era: string | null
}

/**
 * Publish stage: Select questions, generate choices, export to R2
 *
 * Supports dynamic sampling with facet-based filtering:
 * - difficulty: Filter by 'easy', 'normal', 'hard'
 * - era: Filter by '80s', '90s', '00s', '10s', '20s'
 * - series: Filter by series tags (e.g., 'ff', 'dq', 'zelda', 'mario')
 *
 * Idempotency:
 * - If question set for date already exists, skip generation and return early
 * - Uses INSERT OR REPLACE for D1 tables to handle concurrent execution
 * - R2 PUT operation naturally overwrites existing files (idempotent)
 */
export async function handlePublish(
  env: Env,
  dateParam: string | null,
  filters?: FilterOptions,
): Promise<PublishResult> {
  const date = dateParam || getTodayJST()
  const normalizedFilters = normalizeFilters(filters)
  const filterKey = createFilterKey(normalizedFilters)

  const filterStr =
    Object.keys(normalizedFilters).length > 0
      ? ` with filters: ${JSON.stringify(normalizedFilters)}`
      : ' (no filters - daily preset)'
  console.log(`[Publish] START: Generating question set for date=${date}${filterStr}`)

  try {
    // 1. Check if already published (idempotency guard with filter awareness)
    const existing = await env.DB.prepare(
      'SELECT id, items FROM picks WHERE date = ? AND filters_json = ?',
    )
      .bind(date, filterKey)
      .first<{
        id: number
        items: string
      }>()

    if (existing) {
      // Use filter-aware R2 key to distinguish filtered exports from canonical
      const r2Key = buildExportR2Key(date, filterKey)

      const r2Object = await env.STORAGE.head(r2Key)

      if (!r2Object) {
        console.warn(
          `[Publish] WARNING: D1 entry exists but R2 file missing for ${date} (filters=${filterKey}). Attempting recovery from picks table.`,
        )

        try {
          const exportData = JSON.parse(existing.items) as DailyExport
          const exportJson = JSON.stringify(exportData, null, 2)

          await env.STORAGE.put(r2Key, exportJson, {
            httpMetadata: {
              contentType: 'application/json',
            },
          })

          await env.DB.prepare(
            'INSERT OR REPLACE INTO exports (date, r2_key, version, hash, filters_json) VALUES (?, ?, ?, ?, ?)',
          )
            .bind(date, r2Key, exportData.meta.version ?? '1.0.0', exportData.meta.hash, filterKey)
            .run()

          console.log(
            `[Publish] RECOVER: Re-exported ${r2Key} from existing pick data (filters=${filterKey})`,
          )

          return {
            success: true,
            skipped: false,
            date,
            questionsGenerated: exportData.questions.length,
            r2Key,
            hash: exportData.meta.hash,
          }
        } catch (error) {
          console.error(
            `[Publish] ERROR: Failed to recover missing export for ${date} (filters=${filterKey})`,
            error,
          )
          throw error instanceof Error
            ? error
            : new Error('Failed to recover missing export from existing pick')
        }
      }

      console.log(
        `[Publish] SKIP: Question set for ${date} already exists (pick_id=${existing.id}, filters=${filterKey})`,
      )

      return {
        success: true,
        skipped: true,
        date,
        questionsGenerated: 0,
      }
    }

    // 2. Select 10 random available tracks with optional filtering
    const tracks = await selectTracks(env.DB, 10, normalizedFilters)

    if (tracks.length < 10) {
      const filterDesc =
        Object.keys(normalizedFilters).length > 0
          ? ` with filters (${JSON.stringify(normalizedFilters)})`
          : ''
      throw new Error(`Not enough tracks available${filterDesc} (need 10, got ${tracks.length})`)
    }

    // 3. Get all game titles for choice generation
    const allGames = await getAllGameTitles(env.DB)

    // 4. Generate questions with choices
    const questions: Question[] = tracks.map((track, index) => {
      const questionId = `q_${date}_${index + 1}`
      const facets = buildQuestionFacets(track)

      return {
        id: questionId,
        track_id: track.track_id,
        title: track.title,
        game: track.game,
        choices: generateChoices(track.game, allGames, questionId),
        reveal: {
          title: track.title,
          game: track.game,
          composer: track.composer || undefined,
          year: track.year || undefined,
          platform: track.platform || undefined,
          series: track.series || undefined,
          youtube_url: track.youtube_url || undefined,
          spotify_url: track.spotify_url || undefined,
          apple_music_url: track.apple_music_url || undefined,
        },
        facets,
        meta: {
          difficulty: 50, // Phase 1: static score
          notability: 50,
          quality: 50,
        },
      }
    })

    // 5. Create export (without hash first)
    const exportDataWithoutHash: DailyExport = {
      meta: {
        date,
        version: '1.0.0',
        generated_at: new Date().toISOString(),
        hash: '',
      },
      questions,
    }

    // 6. Generate hash from content excluding the hash field itself
    const contentForHash = JSON.stringify({
      meta: {
        date: exportDataWithoutHash.meta.date,
        version: exportDataWithoutHash.meta.version,
        generated_at: exportDataWithoutHash.meta.generated_at,
      },
      questions: exportDataWithoutHash.questions,
    })
    const hash = await sha256(contentForHash)

    // 7. Create final export with hash
    const exportData: DailyExport = {
      ...exportDataWithoutHash,
      meta: {
        ...exportDataWithoutHash.meta,
        hash,
      },
    }

    // 8. Save to picks table (INSERT OR REPLACE for idempotency with filters)
    await env.DB.prepare(
      'INSERT OR REPLACE INTO picks (date, items, status, filters_json) VALUES (?, ?, ?, ?)',
    )
      .bind(date, JSON.stringify(exportData), 'published', filterKey)
      .run()

    // 9. Update pool (mark as picked)
    for (const track of tracks) {
      await env.DB.prepare(
        `UPDATE pool
         SET last_picked_at = CURRENT_TIMESTAMP,
             times_picked = times_picked + 1
         WHERE track_id = ?`,
      )
        .bind(track.track_id)
        .run()
    }

    // 10. Export to R2 (use filter-aware key)
    const r2Key = buildExportR2Key(date, filterKey)
    await env.STORAGE.put(r2Key, JSON.stringify(exportData, null, 2), {
      httpMetadata: {
        contentType: 'application/json',
      },
    })

    console.log(`[Publish] R2: Exported to ${r2Key}`)

    // 11. Save export metadata (INSERT OR REPLACE for idempotency with filters)
    await env.DB.prepare(
      'INSERT OR REPLACE INTO exports (date, r2_key, version, hash, filters_json) VALUES (?, ?, ?, ?, ?)',
    )
      .bind(date, r2Key, '1.0.0', hash, filterKey)
      .run()

    console.log(`[Publish] SUCCESS: ${questions.length} questions generated for ${date}`)
    console.log(`[Publish] Hash: ${hash}`)

    return {
      success: true,
      date,
      questionsGenerated: questions.length,
      r2Key,
      hash,
    }
  } catch (error) {
    console.error(`[Publish] ERROR: Failed for date=${date}`, error)
    return {
      success: false,
      date,
      questionsGenerated: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Select N random available tracks from pool, optionally filtered by facets
 */
async function selectTracks(
  db: D1Database,
  count: number,
  filters?: FilterOptions,
): Promise<TrackRow[]> {
  // Build WHERE clause with optional facet filters
  const whereClauses = ['p.state = ?']
  const bindings: Array<string | number> = ['available']

  if (filters?.difficulty) {
    whereClauses.push('f.difficulty = ?')
    bindings.push(filters.difficulty)
  }

  if (filters?.era) {
    whereClauses.push('f.era = ?')
    bindings.push(filters.era)
  }

  if (filters?.series && filters.series.length > 0) {
    // For series tags (JSON array), check if the JSON string contains the series tag
    // Using LIKE pattern matching as SQLite doesn't support json_contains directly
    const seriesConditions = filters.series.map(() => 'f.series_tags LIKE ?').join(' OR ')
    whereClauses.push(`(${seriesConditions})`)
    // Use pattern: %"ff"% to match "ff" within the JSON array
    bindings.push(...filters.series.map((s) => `%"${s}"%`))
  }

  const whereClause = whereClauses.join(' AND ')
  const query = `SELECT t.*, f.difficulty, f.genres, f.series_tags, f.era
       FROM tracks_normalized t
       INNER JOIN pool p ON t.track_id = p.track_id
       LEFT JOIN track_facets f ON f.track_id = t.track_id
       WHERE ${whereClause}
       ORDER BY RANDOM()
       LIMIT ?`

  bindings.push(count)

  const result = await db
    .prepare(query)
    .bind(...bindings)
    .all<TrackRow>()

  return result.results || []
}

/**
 * Get all game titles for choice generation
 */
async function getAllGameTitles(db: D1Database): Promise<string[]> {
  const result = await db
    .prepare('SELECT DISTINCT game FROM tracks_normalized')
    .all<{ game: string }>()

  return (result.results || []).map((r) => r.game)
}

function parseFacetArray(value: string | null): string[] {
  if (!value) return []

  try {
    const parsed = JSON.parse(value)

    if (!Array.isArray(parsed)) {
      return []
    }

    const filtered = parsed.filter(
      (item): item is string => typeof item === 'string' && item.trim().length > 0,
    )
    return Array.from(new Set(filtered))
  } catch (error) {
    console.warn('[Publish] WARN: Failed to parse facet array', error)
    return []
  }
}

function buildQuestionFacets(track: TrackRow): QuestionFacets | undefined {
  const genres = parseFacetArray(track.genres)
  const seriesTags = parseFacetArray(track.series_tags)

  const result: QuestionFacets = {}

  const difficulty = track.difficulty
  if (difficulty === 'easy' || difficulty === 'normal' || difficulty === 'hard') {
    result.difficulty = difficulty
  }

  if (genres.length > 0) {
    result.genres = genres
  }

  if (seriesTags.length > 0) {
    result.seriesTags = seriesTags
  }

  const era = track.era
  if (era === '80s' || era === '90s' || era === '00s' || era === '10s' || era === '20s') {
    result.era = era
  }

  return Object.keys(result).length > 0 ? result : undefined
}
