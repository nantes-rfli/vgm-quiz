import { generateChoices } from '../../../shared/lib/choices'
import { getTodayJST } from '../../../shared/lib/date'
import { sha256 } from '../../../shared/lib/hash'
import type { Env } from '../../../shared/types/env'
import type { DailyExport, Question } from '../../../shared/types/export'

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
}

/**
 * Publish stage: Select questions, generate choices, export to R2
 *
 * Idempotency:
 * - If question set for date already exists, skip generation and return early
 * - Uses INSERT OR REPLACE for D1 tables to handle concurrent execution
 * - R2 PUT operation naturally overwrites existing files (idempotent)
 */
export async function handlePublish(env: Env, dateParam: string | null): Promise<PublishResult> {
  const date = dateParam || getTodayJST()

  console.log(`[Publish] START: Generating question set for date=${date}`)

  try {
    // 1. Check if already published (idempotency guard)
    const existing = await env.DB.prepare('SELECT id, items FROM picks WHERE date = ?').bind(date).first<{
      id: number
      items: string
    }>()

    if (existing) {
      console.log(`[Publish] SKIP: Question set for ${date} already exists (pick_id=${existing.id})`)

      // Verify R2 consistency
      const r2Key = `exports/${date}.json`
      const r2Object = await env.STORAGE.head(r2Key)

      if (!r2Object) {
        console.warn(`[Publish] WARNING: D1 entry exists but R2 file missing for ${date}`)
      }

      return {
        success: true,
        skipped: true,
        date,
        questionsGenerated: 0,
      }
    }

    // 2. Select 10 random available tracks
    const tracks = await selectTracks(env.DB, 10)

    if (tracks.length < 10) {
      throw new Error(`Not enough tracks available (need 10, got ${tracks.length})`)
    }

    // 3. Get all game titles for choice generation
    const allGames = await getAllGameTitles(env.DB)

    // 4. Generate questions with choices
    const questions: Question[] = tracks.map((track, index) => {
      const questionId = `q_${date}_${index + 1}`

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
        },
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

    // 8. Save to picks table (INSERT OR REPLACE for idempotency)
    await env.DB.prepare('INSERT OR REPLACE INTO picks (date, items, status) VALUES (?, ?, ?)')
      .bind(date, JSON.stringify(exportData), 'published')
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

    // 10. Export to R2 (PUT operation is naturally idempotent - overwrites existing)
    const r2Key = `exports/${date}.json`
    await env.STORAGE.put(r2Key, JSON.stringify(exportData, null, 2), {
      httpMetadata: {
        contentType: 'application/json',
      },
    })

    console.log(`[Publish] R2: Exported to ${r2Key}`)

    // 11. Save export metadata (INSERT OR REPLACE for idempotency)
    await env.DB.prepare('INSERT OR REPLACE INTO exports (date, r2_key, version, hash) VALUES (?, ?, ?, ?)')
      .bind(date, r2Key, '1.0.0', hash)
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
 * Select N random available tracks from pool
 */
async function selectTracks(db: D1Database, count: number): Promise<TrackRow[]> {
  const result = await db
    .prepare(
      `SELECT t.*
       FROM tracks_normalized t
       INNER JOIN pool p ON t.track_id = p.track_id
       WHERE p.state = 'available'
       ORDER BY RANDOM()
       LIMIT ?`,
    )
    .bind(count)
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
