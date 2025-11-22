import {
  buildBackupKey,
  getBackupPrefix,
  getBackupRetentionDays,
  parseDateFromKey,
} from '../../../shared/lib/backups'
import { generateChoices } from '../../../shared/lib/choices'
import { getTodayJST } from '../../../shared/lib/date'
import {
  CANONICAL_FILTER_KEY,
  buildExportR2Key,
  createFilterKey,
  normalizeFilters,
} from '../../../shared/lib/filters'
import { sha256 } from '../../../shared/lib/hash'
import { isObservabilityEnabled, logEvent, sendSlackNotification } from '../../../shared/lib/observability'
import type { Env } from '../../../shared/types/env'
import type { Choice, DailyExport, Question, QuestionFacets } from '../../../shared/types/export'
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
  composer: string | null
}

const COVERAGE_ALERT_THRESHOLD = 0.05
const COVERAGE_SLACK_TITLE = 'Composer coverage alert (Phase4B)'

function computeDifficultyScore(track: TrackRow): number {
  // simple heuristic: map normalized difficulty facet to percentile
  // fall back to 50 when unknown or missing
  switch (track.difficulty) {
    case 'easy':
      return 30
    case 'normal':
      return 50
    case 'hard':
      return 70
    default:
      return 50
  }
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
  options?: { modeId?: string },
): Promise<PublishResult> {
  const date = dateParam || getTodayJST()
  const normalizedFilters = normalizeFilters(filters)
  const modeId = options?.modeId
  const filterKey = createFilterKey(normalizedFilters, modeId)

  const filterStr =
    Object.keys(normalizedFilters).length > 0
      ? ` with filters: ${JSON.stringify(normalizedFilters)}`
      : ' (no filters - daily preset)'
  logEvent(env, 'info', {
    event: 'publish.start',
    status: 'start',
    filtersKey: filterKey,
    fields: { date, filters: normalizedFilters },
    message: `Generating question set${filterStr}`,
  })

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
        logEvent(env, 'warn', {
          event: 'publish.recover.start',
          status: 'start',
          filtersKey: filterKey,
          fields: { date },
          message: 'D1 entry exists but R2 file missing; attempting recovery',
        })

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

          if (filterKey === CANONICAL_FILTER_KEY) {
            await replicateCanonicalBackup(env, {
              filtersKey: filterKey,
              canonicalKey: r2Key,
              exportJson,
              date,
              hash: exportData.meta.hash,
              version: exportData.meta.version ?? '1.0.0',
            })
          }

          logEvent(env, 'info', {
            event: 'publish.recover.success',
            status: 'success',
            filtersKey: filterKey,
            r2Key,
            fields: { date, questionsGenerated: exportData.questions.length },
          })

          return {
            success: true,
            skipped: false,
            date,
            questionsGenerated: exportData.questions.length,
            r2Key,
            hash: exportData.meta.hash,
          }
        } catch (error) {
          logEvent(env, 'error', {
            event: 'publish.recover.fail',
            status: 'fail',
            filtersKey: filterKey,
            fields: { date },
            error,
          })
          throw error instanceof Error
            ? error
            : new Error('Failed to recover missing export from existing pick')
        }
      }

      logEvent(env, 'info', {
        event: 'publish.skip',
        status: 'success',
        filtersKey: filterKey,
        fields: { date, pickId: existing.id },
        message: 'Question set already exists',
      })

      return {
        success: true,
        skipped: true,
        date,
        questionsGenerated: 0,
      }
    }

    const isComposerMode = modeId === 'vgm_composer-ja'

    // 2. Select 10 random available tracks with optional filtering
    if (isComposerMode) {
      const coverage = await getComposerCoverage(env.DB, normalizedFilters)
      const severity = coverage.missingRate > COVERAGE_ALERT_THRESHOLD ? 'warn' : 'info'
      const coverageFields = {
        available: coverage.available,
        withComposer: coverage.withComposer,
        missing: coverage.missing,
        missingRate: coverage.missingRate,
        threshold: COVERAGE_ALERT_THRESHOLD,
        filters: normalizedFilters,
      }

      logEvent(env, severity, {
        event: 'publish.composer.coverage',
        status: severity,
        filtersKey: filterKey,
        fields: coverageFields,
        message: 'Composer metadata coverage snapshot',
      })

      if (severity === 'warn' && isObservabilityEnabled(env)) {
        await sendSlackNotification(env, `【vgm-quiz】${COVERAGE_SLACK_TITLE}`, coverageFields)
      }
    }

    const tracks = await selectTracks(env.DB, 10, normalizedFilters, {
      requireComposer: isComposerMode,
    })

    if (tracks.length < 10) {
      const filterDesc =
        Object.keys(normalizedFilters).length > 0
          ? ` with filters (${JSON.stringify(normalizedFilters)})`
          : ''
      throw new Error(`Not enough tracks available${filterDesc} (need 10, got ${tracks.length})`)
    }

    // 3. Get candidate pools for choice generation
    const allGames = await getAllGameTitles(env.DB)
    const allComposers = isComposerMode ? await getAllComposers(env.DB) : []

    // 4. Generate questions with choices
    const questions: Question[] = tracks.map((track, index) => {
      const questionId = `q_${date}_${index + 1}`
      const facets = buildQuestionFacets(track)

      const choices = isComposerMode
        ? generateComposerChoices(track.composer || 'Unknown composer', allComposers, questionId)
        : generateChoices(track.game, allGames, questionId)

      return {
        id: questionId,
        track_id: track.track_id,
        title: track.title,
        game: track.game,
        choices,
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
          difficulty: computeDifficultyScore(track),
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

    const exportJsonPretty = JSON.stringify(exportData, null, 2)

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
    await env.STORAGE.put(r2Key, exportJsonPretty, {
      httpMetadata: {
        contentType: 'application/json',
      },
    })

    logEvent(env, 'info', {
      event: 'publish.r2.put',
      status: 'success',
      filtersKey: filterKey,
      r2Key,
      fields: { date },
    })

    if (filterKey === CANONICAL_FILTER_KEY) {
      await replicateCanonicalBackup(env, {
        filtersKey: filterKey,
        canonicalKey: r2Key,
        exportJson: exportJsonPretty,
        date,
        hash,
        version: exportData.meta.version,
      })
    }

    // 11. Save export metadata (INSERT OR REPLACE for idempotency with filters)
    await env.DB.prepare(
      'INSERT OR REPLACE INTO exports (date, r2_key, version, hash, filters_json) VALUES (?, ?, ?, ?, ?)',
    )
      .bind(date, r2Key, '1.0.0', hash, filterKey)
      .run()

    logEvent(env, 'info', {
      event: 'publish.success',
      status: 'success',
      filtersKey: filterKey,
      r2Key,
      fields: { date, questionsGenerated: questions.length, hash },
    })

    return {
      success: true,
      date,
      questionsGenerated: questions.length,
      r2Key,
      hash,
    }
  } catch (error) {
    logEvent(env, 'error', {
      event: 'publish.fail',
      status: 'fail',
      filtersKey: filterKey,
      fields: { date },
      error,
    })
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
  options?: { requireComposer?: boolean },
): Promise<TrackRow[]> {
  // Build WHERE clause with optional facet filters
  const whereClauses = ['p.state = ?']
  const bindings: Array<string | number> = ['available']

  if (options?.requireComposer) {
    whereClauses.push('t.composer IS NOT NULL AND t.composer != ""')
  }

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

async function getAllComposers(db: D1Database): Promise<string[]> {
  const result = await db
    .prepare('SELECT DISTINCT composer FROM tracks_normalized WHERE composer IS NOT NULL AND composer != ""')
    .all<{ composer: string }>()

  return (result.results || []).map((r) => r.composer)
}

function generateComposerChoices(
  correctComposer: string,
  allComposers: string[],
  questionId: string,
): Choice[] {
  const unique = Array.from(new Set(allComposers.map((c) => c.trim()).filter(Boolean)))
  const wrongPool = unique.filter((c) => c !== correctComposer)

  if (wrongPool.length < 3) {
    throw new Error(
      `Not enough unique composers to generate choices. Need at least 4 unique, got ${unique.length}`,
    )
  }

  const shuffledWrong = shuffleArrayComposer(wrongPool, `${questionId}-composer`)
  const selectedWrong = shuffledWrong.slice(0, 3)

  const choicesWithoutIds = [
    { text: correctComposer, correct: true },
    { text: selectedWrong[0], correct: false },
    { text: selectedWrong[1], correct: false },
    { text: selectedWrong[2], correct: false },
  ]

  const shuffledChoices = shuffleArrayComposer(
    choicesWithoutIds,
    `${questionId}-composer-shuffle`,
  )
  const choiceIds = ['a', 'b', 'c', 'd'] as const

  return shuffledChoices.map((choice, index) => ({
    id: choiceIds[index],
    text: choice.text,
    correct: choice.correct,
  }))
}

function shuffleArrayComposer<T>(array: T[], seed: string): T[] {
  const arr = [...array]
  const hash = simpleHash(seed)

  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(seededRandom(hash + i) * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }

  return arr
}

function simpleHash(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i += 1) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash &= hash
  }
  return Math.abs(hash)
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

async function getComposerCoverage(
  db: D1Database,
  filters?: FilterOptions,
): Promise<{ available: number; withComposer: number; missing: number; missingRate: number }> {
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
    const seriesConditions = filters.series.map(() => 'f.series_tags LIKE ?').join(' OR ')
    whereClauses.push(`(${seriesConditions})`)
    bindings.push(...filters.series.map((s) => `%"${s}"%`))
  }

  const whereClause = whereClauses.join(' AND ')
  const query = `
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN t.composer IS NOT NULL AND t.composer != '' THEN 1 ELSE 0 END) as withComposer
    FROM tracks_normalized t
    INNER JOIN pool p ON t.track_id = p.track_id
    LEFT JOIN track_facets f ON f.track_id = t.track_id
    WHERE ${whereClause}
  `

  const result = await db.prepare(query).bind(...bindings).first<{ total: number; withComposer: number }>()
  const available = result?.total ?? 0
  const withComposer = result?.withComposer ?? 0
  const missing = Math.max(available - withComposer, 0)
  const missingRate = available > 0 ? missing / available : 1

  return { available, withComposer, missing, missingRate }
}

interface BackupParams {
  filtersKey: string
  canonicalKey: string
  exportJson: string
  date: string
  hash: string
  version: string
}

async function replicateCanonicalBackup(env: Env, params: BackupParams): Promise<void> {
  const prefix = getBackupPrefix(env)
  if (!prefix) return

  const backupKey = buildBackupKey(prefix, params.canonicalKey)
  if (!backupKey) {
    logEvent(env, 'warn', {
      event: 'publish.backup.skip',
      status: 'fail',
      filtersKey: params.filtersKey,
      message: 'Unable to derive backup key from canonical export',
      r2Key: params.canonicalKey,
    })
    return
  }
  try {
    await env.STORAGE.put(backupKey, params.exportJson, {
      httpMetadata: {
        contentType: 'application/json',
      },
      customMetadata: {
        source: 'daily',
        hash: params.hash,
        version: params.version,
      },
    })

    logEvent(env, 'info', {
      event: 'publish.backup.put',
      status: 'success',
      filtersKey: params.filtersKey,
      r2Key: backupKey,
      fields: { date: params.date },
    })
  } catch (error) {
    logEvent(env, 'warn', {
      event: 'publish.backup.put',
      status: 'fail',
      filtersKey: params.filtersKey,
      r2Key: backupKey,
      error,
    })
    return
  }

  const retentionDays = getBackupRetentionDays(env)
  if (retentionDays <= 0) {
    return
  }

  try {
    await pruneExpiredBackups(env, prefix, retentionDays, params.filtersKey)
  } catch (error) {
    logEvent(env, 'warn', {
      event: 'publish.backup.prune.fail',
      status: 'fail',
      filtersKey: params.filtersKey,
      r2Key: backupKey,
      error,
    })
  }
}

async function pruneExpiredBackups(
  env: Env,
  prefix: string,
  retentionDays: number,
  filtersKey: string,
): Promise<void> {
  const listResult = await env.STORAGE.list({ prefix: `${prefix}/` })
  if (!listResult.objects || listResult.objects.length === 0) {
    return
  }

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - retentionDays)
  const cutoffIso = cutoff.toISOString().split('T')[0]

  for (const object of listResult.objects) {
    const objectDate = parseDateFromKey(object.key)
    if (!objectDate) {
      logEvent(env, 'warn', {
        event: 'publish.backup.prune.skip',
        status: 'fail',
        filtersKey,
        r2Key: object.key,
        message: 'Unable to derive date from backup key',
      })
      continue
    }

    if (objectDate < cutoff) {
      await env.STORAGE.delete(object.key)
      logEvent(env, 'info', {
        event: 'publish.backup.prune',
        status: 'success',
        filtersKey,
        r2Key: object.key,
        fields: { cutoff: cutoffIso },
      })
    }
  }
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
