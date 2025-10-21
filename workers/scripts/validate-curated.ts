import { readFile } from 'node:fs/promises'
import { type ZodIssue, z } from 'zod'

const VALID_DIFFICULTIES = ['easy', 'normal', 'hard'] as const
const VALID_GENRES = [
  'action',
  'action-adventure',
  'action-rpg',
  'adventure',
  'arcade',
  'fighting',
  'fps',
  'indie',
  'jrpg',
  'platformer',
  'puzzle',
  'rpg',
  'shooter',
  'simulation',
  'strategy',
] as const
const VALID_SERIES_TAGS = [
  'chrono',
  'civ',
  'dq',
  'ff',
  'halo',
  'kh',
  'mario',
  'metroid',
  'nier',
  'persona',
  'pokemon',
  'portal',
  'sf',
  'sonic',
  'sotc',
  'tes',
  'tetris',
  'undertale',
  'xenoblade',
  'zelda',
] as const
const VALID_ERAS = ['80s', '90s', '00s', '10s', '20s'] as const

const TrackSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  game: z.string().min(1),
  series: z.string().optional(),
  composer: z.string().min(1),
  platform: z.string().optional(),
  year: z.number().int().min(1980).max(2030),
  youtube_url: z.string().url().optional(),
  spotify_url: z.string().url().optional(),
  apple_music_url: z.string().url().optional(),
  difficulty: z.enum(VALID_DIFFICULTIES).optional(),
  genres: z.array(z.enum(VALID_GENRES)).nonempty().optional(),
  seriesTags: z.array(z.enum(VALID_SERIES_TAGS)).optional(),
  era: z.enum(VALID_ERAS).optional(),
}).superRefine((value, ctx) => {
  if (!value.youtube_url && !value.spotify_url && !value.apple_music_url) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'At least one of youtube_url, spotify_url, or apple_music_url is required',
      path: ['youtube_url'],
    })
  }
})

type Track = z.infer<typeof TrackSchema>

const CuratedDataSchema = z.object({
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  tracks: z.array(z.unknown()).min(4),
})

type ValidationStats = {
  version: string
  trackCount: number
  uniqueGames: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function extractTracks(value: unknown): unknown[] {
  if (isRecord(value)) {
    const maybeTracks = (value as { tracks?: unknown }).tracks
    if (Array.isArray(maybeTracks)) {
      return maybeTracks
    }
  }

  return []
}

function getTrackId(value: unknown): string | undefined {
  if (isRecord(value)) {
    const maybeId = (value as { id?: unknown }).id
    if (typeof maybeId === 'string' && maybeId.length > 0) {
      return maybeId
    }
  }

  return undefined
}

function formatIssuePath(path: (string | number)[]): string {
  return path.reduce((acc, segment) => {
    if (typeof segment === 'number') {
      return `${acc}[${segment}]`
    }

    return acc ? `${acc}.${segment}` : segment
  }, '')
}

function formatZodIssue(issue: ZodIssue, prefix: string): string {
  const path = formatIssuePath(issue.path)
  const location = path ? `'${path}'` : 'value'

  if (issue.message === 'Required') {
    return `${prefix}: ${location} is required`
  }

  if (issue.code === 'invalid_enum_value') {
    const received = (issue as typeof issue & { received: unknown }).received
    const options = issue.options.join(', ')
    return `${prefix}: ${location} has invalid value '${received}'. Must be one of: ${options}`
  }

  if (issue.code === 'invalid_type') {
    return `${prefix}: ${location} expected ${issue.expected}, received ${issue.received}`
  }

  if (issue.code === 'too_small') {
    if (issue.type === 'array') {
      return `${prefix}: ${location} must contain at least ${issue.minimum} item(s)`
    }

    if (issue.type === 'string') {
      return `${prefix}: ${location} must be at least ${issue.minimum} character(s)`
    }

    if (issue.type === 'number') {
      return `${prefix}: ${location} must be >= ${issue.minimum}`
    }
  }

  if (issue.code === 'too_big') {
    if (issue.type === 'number') {
      return `${prefix}: ${location} must be <= ${issue.maximum}`
    }
  }

  return `${prefix}: ${location} ${issue.message}`
}

function findDuplicates(values: string[]): string[] {
  const seen = new Set<string>()
  const duplicates = new Set<string>()

  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value)
    } else {
      seen.add(value)
    }
  }

  return [...duplicates]
}

function printValidationResult(errors: string[], warnings: string[], stats: ValidationStats): void {
  if (errors.length > 0) {
    console.error('\n❌ VALIDATION FAILED\n')
    for (const error of errors) {
      console.error(`  • ${error}`)
    }
    console.error(`\nTotal errors: ${errors.length}`)
    process.exit(1)
  }

  if (warnings.length > 0) {
    console.warn('\n⚠️  WARNINGS\n')
    for (const warning of warnings) {
      console.warn(`  • ${warning}`)
    }
    console.warn(`\nTotal warnings: ${warnings.length}`)
  }

  console.log('\n✅ VALIDATION PASSED\n')
  console.log(`  Version: ${stats.version}`)
  console.log(`  Tracks: ${stats.trackCount}`)
  console.log(`  Unique games: ${stats.uniqueGames}`)
}

async function validateCurated(filePath: string): Promise<void> {
  const errors: string[] = []
  const warnings: string[] = []

  let raw: string
  try {
    raw = await readFile(filePath, 'utf-8')
  } catch (error) {
    console.error(`Failed to read ${filePath}:`, error)
    process.exit(1)
  }

  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch (error) {
    console.error('Invalid JSON: Could not parse curated data file')
    process.exit(1)
  }

  const parsedCurated = CuratedDataSchema.safeParse(json)
  let tracksSource: unknown[] = []
  let version = 'unknown'

  if (!parsedCurated.success) {
    for (const issue of parsedCurated.error.issues) {
      errors.push(formatZodIssue(issue, 'Top-level'))
    }

    tracksSource = extractTracks(json)
  } else {
    version = parsedCurated.data.version
    tracksSource = parsedCurated.data.tracks
  }

  const validTracks: Track[] = []

  for (let index = 0; index < tracksSource.length; index += 1) {
    const track = tracksSource[index]
    const prefixBase = `Track ${index + 1}`
    const trackId = getTrackId(track) ?? 'unknown'
    const prefix = `${prefixBase} (${trackId})`
    const result = TrackSchema.safeParse(track)

    if (!result.success) {
      for (const issue of result.error.issues) {
        errors.push(formatZodIssue(issue, prefix))
      }
    } else {
      validTracks.push(result.data)
    }
  }

  let uniqueGameCount = 0

  if (validTracks.length > 0) {
    const duplicateIds = findDuplicates(validTracks.map((track) => track.id))
    if (duplicateIds.length > 0) {
      errors.push(`Duplicate track IDs found: ${duplicateIds.join(', ')}`)
    }

    const uniqueGames = new Set(validTracks.map((track) => track.game))
    uniqueGameCount = uniqueGames.size

    if (uniqueGames.size < 4) {
      errors.push(
        `CRITICAL: Only ${uniqueGames.size} unique games found. Minimum 4 required for choice generation.`,
      )
      errors.push(`Games: ${Array.from(uniqueGames).join(', ')}`)
    } else if (uniqueGames.size < validTracks.length * 0.8) {
      warnings.push(
        `Low game variety: ${uniqueGames.size} unique games across ${validTracks.length} tracks.`,
      )
    }
  }

  printValidationResult(errors, warnings, {
    version,
    trackCount: tracksSource.length,
    uniqueGames: uniqueGameCount,
  })
}

validateCurated('./data/curated.json')
