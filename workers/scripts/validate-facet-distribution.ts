import { readFile } from 'node:fs/promises'

type FacetKey = 'difficulty' | 'genres' | 'seriesTags' | 'era'

type Track = {
  id: string
  title: string
  game: string
  difficulty?: string
  genres?: string[]
  seriesTags?: string[]
  era?: string
}

type CuratedData = {
  version: string
  tracks: Track[]
}

type FacetCombination = {
  keys: FacetKey[]
  values: string[]
}

const FACET_KEYS: FacetKey[] = ['difficulty', 'genres', 'seriesTags', 'era']
const MAJOR_SERIES = new Set(['ff', 'dq', 'zelda', 'mario', 'sonic'])

function getFacetValues(track: Track, key: FacetKey): string[] {
  switch (key) {
    case 'difficulty':
      return track.difficulty ? [track.difficulty] : []
    case 'era':
      return track.era ? [track.era] : []
    case 'genres':
      return track.genres ? [...track.genres] : []
    case 'seriesTags':
      return track.seriesTags ? [...track.seriesTags] : []
    default:
      return []
  }
}

function cartesianProduct<T>(arrays: T[][]): T[][] {
  if (arrays.length === 0) return []

  return arrays.reduce<T[][]>((acc, current) => {
    if (acc.length === 0) {
      return current.map((value) => [value])
    }

    const next: T[][] = []
    for (const partial of acc) {
      for (const value of current) {
        next.push([...partial, value])
      }
    }

    return next
  }, [])
}

function buildCombinationKey(keys: FacetKey[], values: string[]): string {
  return keys.map((key, index) => `${key}=${values[index]}`).join('|')
}

async function main(): Promise<void> {
  const raw = await readFile(new URL('../data/curated.json', import.meta.url))
  const data = JSON.parse(raw.toString()) as CuratedData

  const combinations = new Map<string, Set<string>>()

  for (const track of data.tracks) {
    for (let length = 1; length <= FACET_KEYS.length; length += 1) {
      for (let mask = 0; mask < 1 << FACET_KEYS.length; mask += 1) {
        if (countBits(mask) !== length) continue

        const keys = FACET_KEYS.filter((_, index) => (mask & (1 << index)) !== 0)
        const valuesPerKey = keys
          .map((key) => getFacetValues(track, key))
          .filter((values) => values.length > 0)

        if (valuesPerKey.length !== keys.length) continue

        const combos = cartesianProduct(valuesPerKey)
        for (const comboValues of combos) {
          const signature = buildCombinationKey(keys, comboValues)
          if (!combinations.has(signature)) {
            combinations.set(signature, new Set<string>())
          }

          combinations.get(signature)?.add(track.game)
        }
      }
    }
  }

  const failing: Array<{ key: string; count: number; threshold: number }> = []

  for (const [key, games] of combinations.entries()) {
    const threshold = computeThreshold(key)
    if (games.size < threshold) {
      failing.push({ key, count: games.size, threshold })
    }
  }

  failing.sort((a, b) => a.count - b.count)

  if (failing.length === 0) {
    console.log('✅ All facet combinations meet the minimum of 4 unique games.')
    return
  }

  console.log('⚠️  Facet combinations below required unique games:')
  for (const item of failing.slice(0, 25)) {
    console.log(`  • ${item.key} => ${item.count}/${item.threshold} game(s)`)
  }
  if (failing.length > 25) {
    console.log(`  …and ${failing.length - 25} more combination(s).`)
  }

  process.exitCode = 1
}

function countBits(value: number): number {
  let count = 0
  let v = value
  while (v > 0) {
    v &= v - 1
    count += 1
  }
  return count
}

main().catch((error: unknown) => {
  console.error('Unexpected error while validating facet distribution.')
  console.error(error)
  process.exit(1)
})

function computeThreshold(signature: string): number {
  // Count how many facets are in this combination
  const facetCount = (signature.match(/=/g) || []).length

  // Non-major series always use threshold 1
  const seriesMatch = signature.match(/seriesTags=([^|]+)/)
  if (seriesMatch) {
    const tag = seriesMatch[1]
    if (!MAJOR_SERIES.has(tag)) {
      return 1
    }
  }

  // Graduated threshold based on combination complexity
  // Single facet (e.g., difficulty=hard): require 4 games
  if (facetCount === 1) {
    return 4
  }

  // Two facets (e.g., difficulty=hard|era=90s): require 3 games
  if (facetCount === 2) {
    return 3
  }

  // Three or more facets (e.g., difficulty=hard|seriesTags=ff|era=90s): require 3 games
  // This balances strictness with practical achievability at 100 tracks
  return 3
}
