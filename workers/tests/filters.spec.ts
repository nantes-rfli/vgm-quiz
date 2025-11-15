import { describe, expect, it } from 'vitest'
import {
  CANONICAL_FILTER_KEY,
  buildExportR2Key,
  createFilterKey,
  hashFilterKey,
  normalizeFilters,
} from '../shared/lib/filters'
import type { FilterOptions } from '../shared/types/filters'

describe('filter utilities', () => {
  it('normalizes undefined filters to empty object', () => {
    expect(normalizeFilters()).toEqual({})
  })

  it('normalizes and sorts series values', () => {
    const filters: FilterOptions = { series: ['zelda', 'ff', 'zelda', 'dq'] }
    expect(normalizeFilters(filters)).toEqual({ series: ['dq', 'ff', 'zelda'] })
  })

  it('creates canonical key for empty filters', () => {
    expect(createFilterKey(undefined)).toBe(CANONICAL_FILTER_KEY)
  })

  it('creates stable filter key for complex filters', () => {
    const key = createFilterKey({ difficulty: 'hard', era: '90s', series: ['zelda', 'ff'] })
    expect(key).toBe('{"difficulty":"hard","era":"90s","series":["ff","zelda"]}')
  })

  it('hashes filter key deterministically', () => {
    const key = createFilterKey({ difficulty: 'hard' })
    expect(hashFilterKey(key)).toBe(hashFilterKey(key))
  })

  it('builds canonical R2 key for default filters', () => {
    const key = buildExportR2Key('2025-11-03', CANONICAL_FILTER_KEY)
    expect(key).toBe('exports/daily/2025-11-03.json')
  })

  it('builds hashed R2 key when filters provided', () => {
    const filtersKey = createFilterKey({ difficulty: 'hard' })
    const r2Key = buildExportR2Key('2025-11-03', filtersKey)
    expect(r2Key.startsWith('exports/2025-11-03_')).toBe(true)
    expect(r2Key.endsWith('.json')).toBe(true)
  })
})
