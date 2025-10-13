import { readFile } from 'node:fs/promises'
import { z } from 'zod'

const TrackSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  game: z.string().min(1),
  series: z.string().optional(),
  composer: z.string().optional(),
  platform: z.string().optional(),
  year: z.number().min(1980).max(2030).optional(),
  youtube_url: z.string().url().optional(),
  spotify_url: z.string().url().optional(),
})

const CuratedDataSchema = z.object({
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  tracks: z.array(TrackSchema).min(4), // Minimum 4 tracks for 4-choice questions
})

async function validateCurated(filePath: string): Promise<void> {
  const json = JSON.parse(await readFile(filePath, 'utf-8'))
  const result = CuratedDataSchema.safeParse(json)

  if (!result.success) {
    console.error('❌ Validation failed:')
    console.error(result.error.format())
    process.exit(1)
  }

  console.log('✅ Validation passed!')
  console.log(`   Version: ${result.data.version}`)
  console.log(`   Tracks: ${result.data.tracks.length}`)

  // Check for duplicate IDs
  const ids = result.data.tracks.map((t) => t.id)
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index)
  if (duplicates.length > 0) {
    console.error('❌ Duplicate IDs found:', duplicates)
    process.exit(1)
  }

  // Check for duplicate games (should have variety)
  const games = result.data.tracks.map((t) => t.game)
  const uniqueGames = new Set(games)

  console.log(`   Unique games: ${uniqueGames.size}`)

  // Ensure minimum 4 unique games for 4-choice questions
  if (uniqueGames.size < 4) {
    console.error('❌ Insufficient unique games: Need at least 4 unique game titles for 4-choice questions')
    process.exit(1)
  }

  if (uniqueGames.size < games.length * 0.8) {
    console.warn('⚠️  Low game variety (many duplicates)')
  }

  console.log('✅ All checks passed!')
}

validateCurated('./data/curated.json')
