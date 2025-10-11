import curatedData from '../../../data/curated.json'
import type { Env } from '../../../shared/types/env'
import type { CuratedData, Track } from '../../../shared/types/track'

interface DiscoveryResult {
  success: boolean
  tracksInserted: number
  tracksUpdated: number
  errors: string[]
}

/**
 * Discovery stage: Load curated.json into D1
 */
export async function handleDiscovery(env: Env): Promise<DiscoveryResult> {
  const data = curatedData as CuratedData
  const errors: string[] = []
  let inserted = 0
  let updated = 0

  console.log(`Discovery: Processing ${data.tracks.length} tracks`)

  for (const track of data.tracks) {
    try {
      // Check if track exists before upsert
      const existing = await env.DB.prepare(
        'SELECT track_id FROM tracks_normalized WHERE external_id = ?',
      )
        .bind(track.id)
        .first()

      await upsertTrack(env.DB, track)

      // Count insert or update
      if (existing) {
        updated++
      } else {
        inserted++
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      errors.push(`Track ${track.id}: ${message}`)
      console.error(`Failed to upsert track ${track.id}:`, error)
    }
  }

  console.log(
    `Discovery complete: ${inserted} inserted, ${updated} updated, ${errors.length} errors`,
  )

  return {
    success: errors.length === 0,
    tracksInserted: inserted,
    tracksUpdated: updated,
    errors,
  }
}

/**
 * Upsert track into tracks_normalized and pool tables
 */
async function upsertTrack(db: D1Database, track: Track): Promise<void> {
  // Insert or replace into tracks_normalized
  await db
    .prepare(
      `INSERT INTO tracks_normalized
       (external_id, title, game, series, composer, platform, year, youtube_url, spotify_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(external_id) DO UPDATE SET
         title = excluded.title,
         game = excluded.game,
         series = excluded.series,
         composer = excluded.composer,
         platform = excluded.platform,
         year = excluded.year,
         youtube_url = excluded.youtube_url,
         spotify_url = excluded.spotify_url`,
    )
    .bind(
      track.id,
      track.title,
      track.game,
      track.series || null,
      track.composer || null,
      track.platform || null,
      track.year || null,
      track.youtube_url || null,
      track.spotify_url || null,
    )
    .run()

  // Get the track_id
  const result = await db
    .prepare('SELECT track_id FROM tracks_normalized WHERE external_id = ?')
    .bind(track.id)
    .first<{ track_id: number }>()

  if (!result) {
    throw new Error(`Failed to get track_id for ${track.id}`)
  }

  // Insert into pool if not exists
  await db
    .prepare(
      `INSERT INTO pool (track_id, state, times_picked)
       VALUES (?, 'available', 0)
       ON CONFLICT(track_id) DO NOTHING`,
    )
    .bind(result.track_id)
    .run()
}
