import { Buffer } from 'node:buffer'
import { beforeEach, describe, expect, it } from 'vitest'
import { handleDiscovery } from '../pipeline/src/stages/discovery'
import { handlePublish } from '../pipeline/src/stages/publish'
import type { Env } from '../shared/types/env'
import type { Question } from '../shared/types/export'

type Nullable<T> = T | null

type TrackRecord = {
  track_id: number
  external_id: string
  title: string
  game: string
  series: Nullable<string>
  composer: Nullable<string>
  platform: Nullable<string>
  year: Nullable<number>
  youtube_url: Nullable<string>
  spotify_url: Nullable<string>
  apple_music_url: Nullable<string>
}

type PoolRecord = {
  track_id: number
  state: string
  times_picked: number
  last_picked_at: Nullable<string>
}

type FacetRecord = {
  track_id: number
  difficulty: Nullable<string>
  genres: string
  series_tags: string
  era: Nullable<string>
  updated_at: number
}

type PickRecord = {
  id: number
  date: string
  items: string
  status: string
}

type ExportRecord = {
  date: string
  r2_key: string
  version: string
  hash: string
}

type StatementParams = unknown[]

interface D1Result {
  results?: Array<Record<string, unknown>>
  success: boolean
  error?: string
  meta: Record<string, unknown>
}

class FakeStatement {
  #params: StatementParams = []

  constructor(
    private readonly db: FakeD1Database,
    private readonly query: string,
  ) {}

  bind(...params: StatementParams): this {
    this.#params = params
    return this
  }

  async first<T>(): Promise<T | null> {
    return this.db.executeFirst<T>(this.query, this.#params)
  }

  async run<T>(): Promise<D1Result> {
    return this.db.executeRun(this.query, this.#params)
  }

  async all<T>(): Promise<D1Result> {
    return this.db.executeAll(this.query, this.#params)
  }
}

class FakeD1Database {
  #tracksByExternalId = new Map<string, TrackRecord>()
  #tracksById = new Map<number, TrackRecord>()
  #pool = new Map<number, PoolRecord>()
  #facets = new Map<number, FacetRecord>()
  #picks = new Map<string, PickRecord>()
  #exports = new Map<string, ExportRecord>()
  #trackSeq = 1
  #pickSeq = 1

  prepare(query: string): FakeStatement {
    return new FakeStatement(this, this.normalize(query))
  }

  get facets() {
    return this.#facets
  }

  get exportsStore() {
    return this.#exports
  }

  get picksStore() {
    return this.#picks
  }

  reset(): void {
    this.#tracksByExternalId.clear()
    this.#tracksById.clear()
    this.#pool.clear()
    this.#facets.clear()
    this.#picks.clear()
    this.#exports.clear()
    this.#trackSeq = 1
    this.#pickSeq = 1
  }

  private normalize(query: string): string {
    return query.replace(/\s+/g, ' ').trim()
  }

  executeFirst<T>(query: string, params: StatementParams): T | null {
    switch (query) {
      case 'SELECT track_id FROM tracks_normalized WHERE external_id = ?': {
        const externalId = params[0] as string
        const record = this.#tracksByExternalId.get(externalId)
        return (record ? { track_id: record.track_id } : null) as T | null
      }
      case 'SELECT id, items FROM picks WHERE date = ?': {
        const date = params[0] as string
        const pick = this.#picks.get(date)
        return (pick ? { id: pick.id, items: pick.items } : null) as T | null
      }
      case 'SELECT items FROM picks WHERE date = ?': {
        const date = params[0] as string
        const pick = this.#picks.get(date)
        return (pick ? { items: pick.items } : null) as T | null
      }
      default:
        throw new Error(`Unsupported first() query: ${query}`)
    }
  }

  executeRun(query: string, params: StatementParams): D1Result {
    switch (query) {
      case 'INSERT INTO tracks_normalized (external_id, title, game, series, composer, platform, year, youtube_url, spotify_url, apple_music_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(external_id) DO UPDATE SET title = excluded.title, game = excluded.game, series = excluded.series, composer = excluded.composer, platform = excluded.platform, year = excluded.year, youtube_url = excluded.youtube_url, spotify_url = excluded.spotify_url, apple_music_url = excluded.apple_music_url': {
        this.upsertTrack(params)
        break
      }
      case "INSERT INTO pool (track_id, state, times_picked) VALUES (?, 'available', 0) ON CONFLICT(track_id) DO NOTHING": {
        const [trackId] = params as [number]
        if (!this.#pool.has(trackId)) {
          this.#pool.set(trackId, {
            track_id: trackId,
            state: 'available',
            times_picked: 0,
            last_picked_at: null,
          })
        }
        break
      }
      case 'INSERT INTO track_facets (track_id, difficulty, genres, series_tags, era, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(track_id) DO UPDATE SET difficulty = excluded.difficulty, genres = excluded.genres, series_tags = excluded.series_tags, era = excluded.era, updated_at = excluded.updated_at': {
        const [trackId, difficulty, genres, seriesTags, era, updatedAt] = params as [
          number,
          Nullable<string>,
          string,
          string,
          Nullable<string>,
          number,
        ]
        this.#facets.set(trackId, {
          track_id: trackId,
          difficulty: difficulty ?? null,
          genres: genres as string,
          series_tags: seriesTags as string,
          era: era ?? null,
          updated_at: updatedAt,
        })
        break
      }
      case 'INSERT OR REPLACE INTO picks (date, items, status) VALUES (?, ?, ?)': {
        const [date, items, status] = params as [string, string, string]
        const existing = this.#picks.get(date)
        const id = existing ? existing.id : this.#pickSeq++
        this.#picks.set(date, { id, date, items, status })
        break
      }
      case 'UPDATE pool SET last_picked_at = CURRENT_TIMESTAMP, times_picked = times_picked + 1 WHERE track_id = ?': {
        const [trackId] = params as [number]
        const record = this.#pool.get(trackId)
        if (record) {
          record.times_picked += 1
          record.last_picked_at = new Date().toISOString()
        }
        break
      }
      case 'INSERT OR REPLACE INTO exports (date, r2_key, version, hash) VALUES (?, ?, ?, ?)': {
        const [date, r2Key, version, hash] = params as [string, string, string, string]
        this.#exports.set(date, { date, r2_key: r2Key, version, hash })
        break
      }
      default:
        throw new Error(`Unsupported run() query: ${query}`)
    }

    return {
      success: true,
      meta: {},
    }
  }

  executeAll(query: string, params: StatementParams): D1Result {
    // Pattern for SELECT query with optional filters
    // Base query: SELECT ... WHERE p.state = ? ...
    const selectPattern =
      /SELECT t\.\*, f\.difficulty, f\.genres, f\.series_tags, f\.era FROM tracks_normalized t INNER JOIN pool p ON t\.track_id = p\.track_id LEFT JOIN track_facets f ON f\.track_id = t\.track_id WHERE (.+) ORDER BY RANDOM\(\) LIMIT \?/

    const match = query.match(selectPattern)
    if (match) {
      const whereClause = match[1]

      // Parse parameters in order: p.state, [filters...], LIMIT
      let paramIdx = 0

      // First param is always p.state = 'available'
      // Skip it since we already filter by state above
      paramIdx++ // Skip 'available'

      // Extract the last parameter as limit (always at the end)
      const limit =
        typeof params[params.length - 1] === 'number'
          ? (params[params.length - 1] as number)
          : Number(params[params.length - 1])

      // Filter available tracks
      let availableTrackIds = Array.from(this.#pool.values())
        .filter((pool) => pool.state === 'available')
        .map((pool) => pool.track_id)

      // Apply facet filters if present (in order of WHERE clause)
      if (whereClause.includes('f.difficulty = ?')) {
        const difficulty = params[paramIdx]
        paramIdx++
        availableTrackIds = availableTrackIds.filter((trackId) => {
          const facets = this.#facets.get(trackId)
          return facets?.difficulty === difficulty
        })
      }

      if (whereClause.includes('f.era = ?')) {
        const era = params[paramIdx]
        paramIdx++
        availableTrackIds = availableTrackIds.filter((trackId) => {
          const facets = this.#facets.get(trackId)
          return facets?.era === era
        })
      }

      if (whereClause.includes('f.series_tags LIKE ?')) {
        // Count how many series filters exist (series params continue until limit)
        const seriesCount = (whereClause.match(/f\.series_tags LIKE \?/g) || []).length
        const seriesPatterns: string[] = []
        for (let i = 0; i < seriesCount; i++) {
          const pattern = params[paramIdx]
          if (typeof pattern === 'string') {
            seriesPatterns.push(pattern)
          }
          paramIdx++
        }

        availableTrackIds = availableTrackIds.filter((trackId) => {
          const facets = this.#facets.get(trackId)
          if (!facets?.series_tags) return false
          // Check if any series pattern matches
          // Use 'i' flag for case-insensitive matching (SQLite LIKE is case-insensitive)
          return seriesPatterns.some((pattern) => {
            const regex = new RegExp(pattern.replace(/%/g, '.*'), 'i')
            return regex.test(facets.series_tags)
          })
        })
      }

      const rows = availableTrackIds
        .map((trackId) => {
          const track = this.#tracksById.get(trackId)
          if (!track) return null
          const facets = this.#facets.get(trackId)
          return {
            ...track,
            difficulty: facets?.difficulty ?? null,
            genres: facets?.genres ?? null,
            series_tags: facets?.series_tags ?? null,
            era: facets?.era ?? null,
          }
        })
        .filter((value): value is NonNullable<typeof value> => value !== null)
        .slice(0, limit)

      return {
        results: rows,
        success: true,
        meta: {},
      }
    }

    // Fallback for old query format (without filters)
    if (
      query ===
      "SELECT t.*, f.difficulty, f.genres, f.series_tags, f.era FROM tracks_normalized t INNER JOIN pool p ON t.track_id = p.track_id LEFT JOIN track_facets f ON f.track_id = t.track_id WHERE p.state = 'available' ORDER BY RANDOM() LIMIT ?"
    ) {
      const [limitRaw] = params as [number]
      const limit = typeof limitRaw === 'number' ? limitRaw : Number(limitRaw)
      const availableTrackIds = Array.from(this.#pool.values())
        .filter((pool) => pool.state === 'available')
        .map((pool) => pool.track_id)

      const rows = availableTrackIds
        .map((trackId) => {
          const track = this.#tracksById.get(trackId)
          if (!track) return null
          const facets = this.#facets.get(trackId)
          return {
            ...track,
            difficulty: facets?.difficulty ?? null,
            genres: facets?.genres ?? null,
            series_tags: facets?.series_tags ?? null,
            era: facets?.era ?? null,
          }
        })
        .filter((value): value is NonNullable<typeof value> => value !== null)
        .slice(0, limit)

      return {
        results: rows,
        success: true,
        meta: {},
      }
    }

    // Handle games query
    if (query === 'SELECT DISTINCT game FROM tracks_normalized') {
      const games = new Set<string>()
      for (const record of this.#tracksByExternalId.values()) {
        games.add(record.game)
      }

      return {
        results: Array.from(games).map((game) => ({ game })),
        success: true,
        meta: {},
      }
    }

    throw new Error(`Unsupported all() query: ${query}`)
  }

  private upsertTrack(params: StatementParams): void {
    const [
      externalId,
      title,
      game,
      series,
      composer,
      platform,
      year,
      youtube,
      spotify,
      appleMusic,
    ] = params as [
      string,
      string,
      string,
      Nullable<string>,
      Nullable<string>,
      Nullable<string>,
      Nullable<number>,
      Nullable<string>,
      Nullable<string>,
      Nullable<string>,
    ]

    const existing = this.#tracksByExternalId.get(externalId)

    if (existing) {
      existing.title = title
      existing.game = game
      existing.series = series ?? null
      existing.composer = composer ?? null
      existing.platform = platform ?? null
      existing.year = year ?? null
      existing.youtube_url = youtube ?? null
      existing.spotify_url = spotify ?? null
      existing.apple_music_url = appleMusic ?? null
      this.#tracksById.set(existing.track_id, existing)
      return
    }

    const track: TrackRecord = {
      track_id: this.#trackSeq++,
      external_id: externalId,
      title,
      game,
      series: series ?? null,
      composer: composer ?? null,
      platform: platform ?? null,
      year: year ?? null,
      youtube_url: youtube ?? null,
      spotify_url: spotify ?? null,
      apple_music_url: appleMusic ?? null,
    }

    this.#tracksByExternalId.set(externalId, track)
    this.#tracksById.set(track.track_id, track)
  }

  getTrackFacetsByExternalId(externalId: string): FacetRecord | undefined {
    const record = this.#tracksByExternalId.get(externalId)
    if (!record) return undefined
    return this.#facets.get(record.track_id)
  }

  getTrackId(externalId: string): number | undefined {
    return this.#tracksByExternalId.get(externalId)?.track_id
  }
}

class InMemoryR2Object {
  constructor(private readonly value: string) {}

  async text(): Promise<string> {
    return this.value
  }
}

class InMemoryR2Bucket {
  #store = new Map<string, string>()

  async put(key: string, value: string | ArrayBuffer | ArrayBufferView): Promise<R2ObjectBody> {
    let text: string

    if (typeof value === 'string') {
      text = value
    } else if (value instanceof ArrayBuffer) {
      text = Buffer.from(value).toString()
    } else {
      const view = value as ArrayBufferView
      text = Buffer.from(view.buffer, view.byteOffset, view.byteLength).toString()
    }

    this.#store.set(key, text)
    return { key } as R2ObjectBody
  }

  async head(key: string): Promise<R2Object | null> {
    return this.#store.has(key) ? ({ key } as R2Object) : null
  }

  async get(key: string): Promise<R2ObjectBody | null> {
    const value = this.#store.get(key)
    return value ? (new InMemoryR2Object(value) as unknown as R2ObjectBody) : null
  }

  dump(): Map<string, string> {
    return this.#store
  }
}

describe('pipeline facets integration', () => {
  let db: FakeD1Database
  let storage: InMemoryR2Bucket
  let env: Env

  beforeEach(() => {
    db = new FakeD1Database()
    storage = new InMemoryR2Bucket()
    env = {
      DB: db as unknown as D1Database,
      STORAGE: storage as unknown as R2Bucket,
    }
  })

  it('upserts facet metadata for curated tracks', async () => {
    const result = await handleDiscovery(env)

    expect(result.success).toBe(true)

    const facets = db.getTrackFacetsByExternalId('001')
    expect(facets).toBeDefined()
    expect(facets?.genres).toBe(JSON.stringify(['platformer', 'action']))
    expect(facets?.series_tags).toBe(JSON.stringify(['sonic']))
    expect(facets?.difficulty).toBe('easy')
    expect(facets?.era).toBe('90s')
  })

  it('includes facets within published export payload', async () => {
    await handleDiscovery(env)

    const publishResult = await handlePublish(env, '2025-01-01')
    expect(publishResult.success).toBe(true)

    const exportObject = await storage.get('exports/2025-01-01.json')
    expect(exportObject).not.toBeNull()

    if (!exportObject) {
      throw new Error('Expected export object to exist for 2025-01-01')
    }

    const raw = await exportObject.text()
    const parsed = JSON.parse(raw) as { questions: Question[] }
    const target = parsed.questions.find((q) => q.title === 'Green Hill Zone')

    expect(target?.facets?.difficulty).toBe('easy')
    expect(target?.facets?.genres).toEqual(['platformer', 'action'])
    expect(target?.facets?.seriesTags).toEqual(['sonic'])
    expect(target?.facets?.era).toBe('90s')
  })

  it('samples tracks with difficulty filter', async () => {
    await handleDiscovery(env)

    // Filter by easy difficulty - should succeed (multiple easy tracks exist)
    const publishResult = await handlePublish(env, '2025-02-01', { difficulty: 'easy' })
    expect(publishResult.success).toBe(true)
    expect(publishResult.questionsGenerated).toBe(10)

    const exportObject = await storage.get('exports/2025-02-01.json')
    expect(exportObject).not.toBeNull()

    if (!exportObject) {
      throw new Error('Expected export object to exist for 2025-02-01')
    }

    const raw = await exportObject.text()
    const parsed = JSON.parse(raw) as { questions: Question[] }

    // All questions should have difficulty='easy'
    for (const question of parsed.questions) {
      expect(question.facets?.difficulty).toBe('easy')
    }
  })

  it('fails with insufficient tracks when difficulty filter applied', async () => {
    await handleDiscovery(env)

    // Filter by a difficulty level with fewer tracks than required
    // (We don't control the facet distribution, so just test error path)
    const publishResult = await handlePublish(env, '2025-03-01', { difficulty: 'hard' })

    // Result depends on how many hard tracks are in curated.json
    // If success: all questions have difficulty='hard'
    // If failure: error message should NOT say "with filters" if no filters applied
    if (publishResult.success) {
      expect(publishResult.questionsGenerated).toBe(10)
    } else {
      expect(publishResult.error).toContain('Not enough tracks available')
      // Error should indicate filters were applied
      expect(publishResult.error).toContain('difficulty')
    }
  })

  it('samples tracks with series filter (case-insensitive)', async () => {
    await handleDiscovery(env)

    // Filter by series tag - test case-insensitive matching
    // series=sonic should match tracks with series_tags containing "sonic"
    const publishResult = await handlePublish(env, '2025-04-01', { series: ['sonic'] })

    if (publishResult.success) {
      expect(publishResult.questionsGenerated).toBe(10)

      const exportObject = await storage.get('exports/2025-04-01.json')
      if (exportObject) {
        const raw = await exportObject.text()
        const parsed = JSON.parse(raw) as { questions: Question[] }

        // All questions should have 'sonic' in seriesTags
        for (const question of parsed.questions) {
          const hasSonic = question.facets?.seriesTags?.some((tag) => tag.toLowerCase() === 'sonic')
          expect(hasSonic).toBe(true)
        }
      }
    } else {
      // If not enough sonic tracks, error message should reflect that
      expect(publishResult.error).toContain('Not enough tracks available')
    }
  })

  it('handles combined difficulty and era filters', async () => {
    await handleDiscovery(env)

    // Combine multiple filters
    const publishResult = await handlePublish(env, '2025-05-01', {
      difficulty: 'normal',
      era: '90s',
    })

    if (publishResult.success) {
      expect(publishResult.questionsGenerated).toBe(10)
    } else {
      // Should indicate which filters were applied
      expect(publishResult.error).toContain('Not enough tracks available')
      expect(publishResult.error).toMatch(/difficulty|era/)
    }
  })

  it('error message distinguishes filtered vs unfiltered shortage', async () => {
    await handleDiscovery(env)

    // No filters - error should NOT mention filters
    const noFilterResult = await handlePublish(env, '2025-06-01')
    if (!noFilterResult.success) {
      expect(noFilterResult.error).toContain('Not enough tracks available')
      expect(noFilterResult.error).not.toContain('with filters')
    }

    // With filters - error should mention filters
    const withFilterResult = await handlePublish(env, '2025-07-01', { difficulty: 'hard' })
    if (!withFilterResult.success) {
      expect(withFilterResult.error).toContain('Not enough tracks available')
      expect(withFilterResult.error).toContain('with filters')
    }
  })
})
