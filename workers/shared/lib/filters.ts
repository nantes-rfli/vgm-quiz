import type { FilterOptions } from '../types/filters'

export const CANONICAL_FILTER_KEY = '{}'
const DAILY_EXPORT_PREFIX = 'exports/daily'

export function normalizeFilters(filters?: FilterOptions | null): FilterOptions {
  if (!filters) {
    return {}
  }

  const normalized: FilterOptions = {}

  if (filters.difficulty) {
    normalized.difficulty = String(filters.difficulty)
  }

  if (filters.era) {
    normalized.era = String(filters.era)
  }

  if (filters.series && filters.series.length > 0) {
    const uniqueSeries = Array.from(
      new Set(filters.series.map((value) => String(value).trim()).filter(Boolean)),
    )
    if (uniqueSeries.length > 0) {
      normalized.series = uniqueSeries.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    }
  }

  return normalized
}

export function createFilterKey(filters?: FilterOptions | null): string {
  const normalized = normalizeFilters(filters)
  if (Object.keys(normalized).length === 0) {
    return CANONICAL_FILTER_KEY
  }

  const sortedKeys = Object.keys(normalized).sort()
  const payload: Record<string, unknown> = {}

  for (const key of sortedKeys) {
    const value = normalized[key as keyof FilterOptions]
    if (Array.isArray(value)) {
      payload[key] = value.slice().sort()
    } else if (value !== undefined) {
      payload[key] = value
    }
  }

  return JSON.stringify(payload)
}

export function hashFilterKey(filterJson: string): string {
  let hash = 0
  for (let i = 0; i < filterJson.length; i += 1) {
    const charCode = filterJson.charCodeAt(i)
    hash = (hash << 5) - hash + charCode
    hash |= 0
  }
  return Math.abs(hash).toString(16).padStart(8, '0')
}

export function buildLegacyCanonicalR2Key(date: string): string {
  return `exports/${date}.json`
}

export function buildExportR2Key(date: string, filterKey: string): string {
  if (filterKey === CANONICAL_FILTER_KEY) {
    return `${DAILY_EXPORT_PREFIX}/${date}.json`
  }
  return `exports/${date}_${hashFilterKey(filterKey)}.json`
}

export function isCanonicalFilterKey(filterKey: string): boolean {
  return filterKey === CANONICAL_FILTER_KEY
}
